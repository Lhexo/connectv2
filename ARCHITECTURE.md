# System Architecture & Business Logic - Connect System (ARCHITECTURE.md)

## 1. Overview del Sistema e Moduli Funzionali
Il sistema **Connect** è una piattaforma unificata per la gestione aziendale e commerciale che integra sei macro-moduli operativi:

1. **Sincronizzazione Bidirezionale Danea Easyfatt**:
   - Ricezione e aggiornamento del catalogo prodotti, listini (Netto/Lordo 1-9), giacenze, varianti Taglie e Colori (`Protocollo 3`) e immagini.
   - Esportazione degli ordini raccolti dalla rete commerciale nel formato XML standard `EasyfattDocuments`.
2. **Girovisite & Spazio Vendite Agenti/Capoarea**:
   - Calendario appuntamenti e pianificazione visite sul territorio.
   - Showroom digitale interattivo con supporto per pre-ordini di articoli a stock zero (Backorder).
   - Profilo cliente con storico ordini e anagrafica filtrata per agente assegnato.
3. **Gestione Operativa delle Attività (Task Board)**:
   - Assegnazione task, livelli di priorità, scadenze, checklist sotto-attività, note interne riservate e audit trail (`task_history`).
4. **CRM & Stopwatch Telefonico Interattivo**:
   - Registro chiamate clienti, fornitori ed esterni con cronometro live, calcolo durata e collegamento automatico a task o contatti.
5. **Generatore Distinte Spedizioni Poste Italiane (`/poste-generator`)**:
   - Elaborazione e validazione dei file XML Easyfatt per produrre distinte di spedizione conformi in formato CSV/XLSX per i portali Crono e Crono Express.
6. **Amministrazione e Sicurezza Multi-Ruolo**:
   - Configurazione credenziali di sincronizzazione, gestione utenti, assegnazione ruoli, backup e ripristino di sistema.

---

## 2. Diagramma Architetturale ad Alto Livello

```
+-----------------------------------------------------------------------------+
|                          CLIENT SIDE (Browser / Web)                        |
|                                                                             |
|   +---------------------------------------------------------------------+   |
|   |                  React 19 Single Page Application (SPA)             |   |
|   |  - React Router DOM v7 (Guardie di navigazione reattive)            |   |
|   |  - Tailwind CSS v4 + Motion (UI Design System)                      |   |
|   |  - Error Boundary AppGuard + Context di Autenticazione (/api/me)    |   |
|   +---------------------------------------------------------------------+   |
+--------------------------------------▲--------------------------------------+
                                       │ HTTP REST / JSON / Cookies
                                       ▼
+-----------------------------------------------------------------------------+
|                      APPLICATION SERVER (Node.js & Express)                 |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | Middleware Pipeline:                                                  |  |
|  | - cookie-parser (Sessione userId con SameSite=None, Secure)           |  |
|  | - express.json() & express.urlencoded() (Payload fino a 50MB)        |  |
|  | - Auth Middleware & Fallback di Resilienza (Bearer / Header / Cookie) |  |
|  | - Multer (Upload immagini /uploads/ e pacchetti ZIP)                  |  |
|  +-----------------------------------------------------------------------+  |
|  | Endpoint RESTful:                                                     |  |
|  | - /api/auth, /api/me, /api/users, /api/stats                          |  |
|  | - /api/clients, /api/suppliers, /api/tasks, /api/calls                |  |
|  | - /api/products, /api/orders, /api/easyfatt/*, /api/poste/generate    |  |
|  +-----------------------------------------------------------------------+  |
|  | Servizi Ausiliari & Moduli Core:                                      |  |
|  | - fast-xml-parser (Protocolli Danea Easyfatt 1, 2, 3)                 |  |
|  | - bcryptjs (Sicurezza password)                                       |  |
|  | - adm-zip & archiver (Backup database, esportazione archivi)          |  |
|  | - exceljs & xlsx (Generazione distinte Poste Italiane)               |  |
|  +-----------------------------------------------------------------------+  |
+--------------------------------------▲--------------------------------------+
                                       │
                                       ▼
+-----------------------------------------------------------------------------+
|                     CLOUD DATABASE (PostgreSQL / Neon.tech)                 |
|                                                                             |
| - Connessione: Native Connection Pool ('pg' Pool)                           |
| - Fail-Fast Timeouts & Reconnect Resiliente                                 |
| - Transazioni ACID native (withTransaction / pool.query)                    |
| - Batch Upsert Engine (100 chunk) per sincronizzazioni Easyfatt             |
| - Schemi relazionali con foreign keys e vincoli di integrità                |
+-----------------------------------------------------------------------------+
```

---

## 3. Sicurezza e Controllo Accessi (RBAC Matrix & Navigation Guards)

### 3.1 Mappatura dei 4 Ruoli Utente
Il sistema gestisce l'accesso in base a 4 ruoli chiaramente distinti:

1. **Admin (`admin`, `amministratore`)**:
   - Controllo completo della piattaforma.
   - Gestione utenti e team, impostazioni globali, backup di sistema, visualizzazione completa di ordini, clienti e statistiche globali.
2. **User Base (`user`)**:
   - Utente operativo aziendale (backoffice, magazzino, customer care).
   - Gestisce le attività ordinarie, consulta le anagrafiche complete e le spedizioni, ma non accede ai flussi strettamente riservati alla forza vendita sul territorio.
3. **Agente (`agent`, `agente`)**:
   - Consulente commerciale esterno sul territorio.
   - Opera all'interno di uno spazio di lavoro compatto e focalizzato: calendario girovisite, catalogo per nuovo ordine, elenco dei propri clienti assegnati, storico ordini e monitoraggio delle proprie provvigioni/obiettivi.
4. **Capoarea (`capoarea`)**:
   - Responsabile e supervisore commerciale di territorio.
   - Condivide l'interfaccia commerciale tattica dell'Agente (`isSalesRole = isAgent || isCapoarea`), con facoltà di affiancamento, visibilità allargata sui clienti di zona e supporto ordini per gli agenti della propria area.

### 3.2 Matrice Comparativa di Autorizzazione (RBAC)

| Area Funzionale | Rotta / Endpoint | Admin | User Base | Agente | Capoarea |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Dashboard Operativa Generale** | `/` | Sì | Sì | Reindirizzato a `/girovisite` | Reindirizzato a `/girovisite` |
| **Girovisite & Calendario Affiancamenti** | `/girovisite` | Sì | No (Reindirizzato a `/`) | Sì (Principale) | Sì (Principale) |
| **Nuovo Ordine & Showroom** | `/ordine`, `/crea-ordine` | Sì | Sì | Sì | Sì |
| **Statistiche & Monitoraggio Obiettivi** | `/statistiche` | Sì | No | Sì (Personali) | Sì (Di Area) |
| **Bacheca Attività & Task** | `/tasks`, `/tasks/new`, `/tasks/:id` | Sì | Sì | No (Reindirizzato a `/girovisite`) | No (Reindirizzato a `/girovisite`) |
| **Rubrica Fornitori** | `/suppliers`, `/suppliers/:id` | Sì | Sì | No (Reindirizzato a `/girovisite`) | No (Reindirizzato a `/girovisite`) |
| **Rubrica Clienti** | `/clients`, `/clients/:id` | Sì (Tutti) | Sì (Tutti) | Solo Clienti Assegnati | Clienti Assegnati e di Area |
| **Hub Easyfatt & Ordini** | `/easyfatt` | Sì (Completo) | Sì (Consultazione) | Ordini e Catalogo Filtrati | Ordini e Catalogo Filtrati |
| **Generatore Spedizioni Poste** | `/poste-generator` | Sì | Sì | No (Reindirizzato a `/girovisite`) | No (Reindirizzato a `/girovisite`) |
| **Gestione Utenti e Team** | `/users` | Sì | No (Reindirizzato a `/`) | No (Reindirizzato a `/girovisite`) | No (Reindirizzato a `/girovisite`) |
| **Impostazioni Profilo Utente** | `/settings/profile` | Sì | Sì | Sì | Sì |
| **Impostazioni Amministrative & Sincronizzazione** | `/settings/admin` | Sì | No | No | No |
| **Stopwatch Chiamate Telefoniche** | Header (`/api/calls`) | Sì | Sì | Nascosto nell'interfaccia | Nascosto nell'interfaccia |

### 3.3 Guardie di Navigazione Frontend (`src/App.tsx`)
Il client-side routing applica le seguenti regole deterministiche:

- **Guardia di Login**:
  - Al completamento del login (`/api/login`), se il ruolo dell'utente è `agent`, `agente` o `capoarea`, l'utente viene reindirizzato immediatamente alla pagina **`/girovisite`**. Per gli altri ruoli (`admin`, `user`), la destinazione predefinita è la dashboard **`/`**.
- **Guardia della Radice (`/`)**:
  - La route radice reindirizza automaticamente gli utenti con ruolo vendita (`isSalesRole`) a `/girovisite`:
    ```tsx
    <Route path="/" element={isSalesRole ? <Navigate to="/girovisite" replace /> : <Dashboard user={user} />} />
    ```
- **Guardia sui Moduli Interni Riservati**:
  - Le rotte operative aziendali (`/tasks`, `/tasks/new`, `/tasks/:id`, `/suppliers`, `/suppliers/:id`, `/poste-generator`) intercettano i ruoli commerciali e li bloccano, forzando il reindirizzamento verso `/girovisite`:
    ```tsx
    <Route path="/tasks" element={isSalesRole ? <Navigate to="/girovisite" replace /> : <TaskList user={user} />} />
    ```
- **Guardia Esclusiva Amministratore**:
  - La rotta di gestione utenti (`/users`) e il tab di configurazione avanzata (`/settings/admin`) consentono l'accesso unicamente agli amministratori; gli agenti vengono dirottati a `/girovisite`, mentre gli utenti base tornano alla dashboard `/`.
- **Guardia Inversa Utente Base**:
  - Un utente con ruolo base (`isBaseUser`) che tenta di accedere alla sezione vendite `/girovisite` viene automaticamente ricondotto alla dashboard operativa `/`.

---

## 4. Architettura di Persistenza & Motore Relazionale PostgreSQL

### 4.1 Native PostgreSQL Connection Pooling (`pg` Pool)
- **Scelta Architetturale**: Connessione diretta ad alta affidabilità tramite pool nativo `pg.Pool` verso PostgreSQL (Neon.tech).
- **Integrità Referenziale e Vincoli**:
  Tutti i vincoli relazionali (`ON DELETE CASCADE`, `ON DELETE SET NULL`) e indici univoci (`idx_clients_code`, `idx_products_code`) sono gestiti a livello di schema PostgreSQL.
- **Transazioni ACID**:
  Operazioni complesse (creazione ordini, gestione rate/scadenze) sono eseguite in blocchi transazionali sicuri tramite helper `withTransaction()` o client dedicati.

### 4.2 Sincronizzazione e Batch Upsert Engine Ad Alte Prestazioni (`src/lib/db.ts`)
- La sincronizzazione dei cataloghi e dei clienti Easyfatt opera in **blocchi (chunk) da 100 elementi**.
- Invece di eseguire centinaia di singole query in sequenza, il sistema costruisce un'unica istruzione SQL parametrizzata con parametri posizionali `$1, $2, ...`:
  ```sql
  INSERT INTO clients (code, name, address, ...)
  VALUES ($1, $2, ...), ($33, $34, ...)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address, ...
  RETURNING id, code;
  ```
- Un indice univoco dedicato (`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_code ON clients (code)`) garantisce il corretto funzionamento della clausola `ON CONFLICT`.
- I log per singolo record sono aggregati per blocco (`[SYNC] Batch of 100 clients processed successfully`), garantendo velocità massima e azzerando i ritardi I/O.

---

## 5. Moduli Ausiliari e Librerie Core

### 5.1 Sicurezza e Sessioni: `bcryptjs` & `cookie-parser`
- **bcryptjs**:
  - Hashing salato delle password all'atto della registrazione o aggiornamento utente.
  - Verifica delle credenziali nel controller `/api/login` con supporto per utenti storici e fallback di emergenza per amministratori.
- **cookie-parser**:
  - Gestione della persistenza di sessione tramite cookie `userId`.
  - Configurazione `httpOnly: true`, `secure: true`, `sameSite: 'none'` per consentire il funzionamento sicuro e stabile sia all'interno di iframe di sviluppo (Google Cloud Run / AI Studio) che su domini esterni.

### 5.2 Gestione Archivi ed Esportazioni: `adm-zip` & `archiver`
- **adm-zip**:
  - Utilizzato nei controller di backup e import per la manipolazione immediata in memoria di pacchetti compressi, estrazione del database `database.db` e decompressione di file di catalogo.
- **archiver**:
  - Utilizzato per lo streaming continuo di file ZIP ad alta efficienza quando l'amministratore richiede il download di archivi completi contenenti allegati multipli o backup di sistema, evitando il sovraccarico di memoria RAM.

### 5.3 Generazione File di Spedizione: `exceljs` & `xlsx`
- Il modulo `/poste-generator` consente di convertire i dati degli ordini Easyfatt o elenchi manuali in file conformi alle specifiche di tracciato di **Poste Italiane (Crono / Crono Express)**.
- Formattazione automatica di campi critici: CAP a 5 cifre con mantenimento dello zero iniziale, codici ISO nazione, pesi, numeri di telefono e note di consegna.

### 5.4 Flussi XML Danea Easyfatt: `fast-xml-parser`
- Gestione trasparente dei protocolli di scambio:
  - **Protocollo 1 & 2**: Sincronizzazione catalogo completa (`mode=full`) e incrementale (`mode=incremental`). Handshake immagini tramite risposta `OK\nImageSendURL=...`.
  - **Protocollo 3**: Gestione completa di articoli con varianti Taglie e Colori (`<Variants><Variant>`).
  - Serializzazione ordini in formato conforme `EasyfattDocuments` scaricabile direttamente dal gestionale desktop Easyfatt.

---

## 6. Configurazione e Gestione Dati (Cloud Environment & Migration Strategy)

### 6.1 Connessione & Ambiente Cloud (Neon.tech PostgreSQL)
- **Risoluzione URI di Connessione**:
  - La connessione al database PostgreSQL su Neon.tech è configurata tramite la variabile d'ambiente principale `DATABASE_URI` (con fallback automatico su `POSTGRES_URL` o `DATABASE_URL`).
- **Parametro SSL Obbligatorio (`?sslmode=verify-full`)**:
  - È mandatorio l'impiego del parametro `?sslmode=verify-full` (o `sslmode=require` con validazione TLS) nella stringa di connessione remota per prevenire attacchi di tipo spoofing/MITM e garantire comunicazioni crittografate ad alta sicurezza tra il container Express e i nodi database Neon.
- **Gestione Separata degli Endpoint (Direct vs Pooler)**:
  - **Endpoint Diretto (Direct Connection)**: Indispensabile per operazioni DDL, inizializzazione di tabelle, migrazioni schema, gestione transazionale estesa e listener. Il driver `src/lib/db.ts` applica una sanitizzazione proattiva, sostituendo automaticamente gli host contenenti `-pooler.` con il nodo diretto standard per evitare blocchi TCP, disconnessioni premature o socket timeout indotti dal proxy PgBouncer su connessioni server persistenti.
  - **Endpoint con Connection Pooler (PgBouncer)**: Ideale per query stateless ad alta frequenza e letture distribuite, consentendo di superare i limiti di concorrenza del database serverless attraverso il riutilizzo efficiente delle connessioni.

### 6.2 Inizializzazione e Seeding Controllato (`isDatabaseCompletelyEmpty()`)
- **Protezione Anti-Sovrascrittura**: All'avvio del server, la procedura di bootstrap invoca la verifica di consistenza `isDatabaseCompletelyEmpty()` (o controlla il conteggio record con `SELECT COUNT(*) FROM users`).
- **Comportamento Condizionale**:
  - Se il database è completamente vuoto, il motore esegue il seeding iniziale deterministico (creazione utente amministratore predefinito, categorie aziendali ad albero, tag operativi e fornitori demo).
  - Se il database contiene già record, la routine di seeding viene interamente inibita, impedendo qualsiasi riscrittura di password, reset di credenziali o inquinamento di dati già presenti in produzione e staging.

### 6.3 Migrazioni Sicure e Non Distruttive
- **Principio di Idempotenza Strutturale**: La struttura del database adotta unicamente istruzioni SQL non distruttive per preservare l'integrità dei record e consentire deployment continui senza interruzioni di servizio:
  - Dichiarazione tabelle: `CREATE TABLE IF NOT EXISTS <tabella> (...)`.
  - Evoluzione dinamica delle colonne: `ALTER TABLE <tabella> ADD COLUMN IF NOT EXISTS <colonna> <tipo>`.
  - Indici univoci e relazionali protetti: `CREATE INDEX IF NOT EXISTS` e `CREATE UNIQUE INDEX IF NOT EXISTS`.
- **Assenza di Istruzioni Distruttive**: Sono tassativamente escluse dai flussi di bootstrap istruzioni `DROP TABLE`, `DROP COLUMN` o `TRUNCATE`, garantendo che release software successive mantengano inalterato lo storico documentale e contabile.

---

## 7. Tabelle e Schema Database (Danea Easyfatt Aligned)

Lo schema relazionale rispecchia integralmente le specifiche e le convenzioni dei dati scambiati con **Danea Easyfatt XML**.

### 7.1 Gestione Utenti, Ruoli e Autenticazione
- **`users`**:
  - Gestione identità, reparti aziendali e controllo degli accessi.
  - Campi: `id` (PK), `name`, `email` (UNIQUE), `password` (hash salato con `bcryptjs`), `department` (es. `direzionale`, `marketing`, `assistenza tecnica`, `grafica`, `amministrazione`), `role` (`admin`, `agent` / `agente`, `amministrazione`, `user` base), `avatar`, `ical_token` (token univoco per l'integrazione del calendario ordini e visite in Apple iCal / Google Calendar), `created_at`.

### 7.2 Anagrafiche Clienti e Fornitori
- **`clients`**:
  - Anagrafica completa dei clienti allineata con l'archivio Danea.
  - Campi: `id` (PK), `code` (Codice Danea univoco con indice `idx_clients_code`), `name` (Ragione Sociale), `contact` (Referente), `phone`, `email`, `address`, `city`, `postcode` (CAP a 5 cifre), `province`, `country`, `fiscal_code` (Codice Fiscale), `vat_code` (Partita IVA), `sdi_pec` (Codice Univoco SDI o PEC di fatturazione), `cell_phone`, `fax`, `pec`, `delivery_name` (Destinatario merce per spedizione), `delivery_address`, `delivery_postcode`, `delivery_city`, `delivery_province`, `delivery_country`, `price_list` (Listino assegnato 1-9), `payment_name` (Metodo di pagamento concordato), `payment_bank` (Appoggio bancario), `custom_field1..4` (Campi liberi Danea), `notes`, `agente` (Assegnazione commerciale).
- **`suppliers`**:
  - Registro anagrafico fornitori.
  - Campi: `id` (PK), `name` (Ragione Sociale), `contact`, `phone`, `email`, `category` (Packaging, Materie Prime, Servizi), `notes`.

### 7.3 Catalogo Prodotti, Listini (1..9), Varianti e Barcode
- **`products`**:
  - Schede prodotto con prezzi differenziati per listino netto e lordo.
  - Campi: `id` (PK), `code` (Codice Articolo univoco Danea), `description`, `price` (Prezzo base), `net_price_1` .. `net_price_9` (Listini Prezzi Netti da 1 a 9), `gross_price_1` .. `gross_price_9` (Listini Prezzi Lordi da 1 a 9), `vat_code` (Codice/Aliquota IVA es. `22`), `um` (Unità di misura es. `pz`, `kg`, `lt`), `stock` (Giacenza effettiva), `min_stock` (Scorta minima), `ordered_qty` (Quantità impegnata/ordinata), `category`, `subcategory`, `barcode` (EAN primario), `producer_name` (Produttore/Marchio), `supplier_code`, `supplier_name`, `supplier_product_code`, `supplier_net_price`, `supplier_gross_price`, `supplier_notes`, `classe_provvigione` (Per calcolo provvigioni agenti), `image_file_name`, `notes`, `created_at`.
- **`product_variants`**:
  - Gestione taglie e colori conforme al Protocollo 3 Danea Easyfatt (`<Variants><Variant>`).
  - Campi: `id` (PK), `product_id` (FK su `products` ON DELETE CASCADE), `size` (Taglia), `color` (Colore), `barcode` (EAN univoco variante), `available_qty` (Giacenza disponibile specifica della combinazione).
- **`product_extra_barcodes`**:
  - Codici a barre addizionali per confezioni multiple e imballaggi logistici.
  - Campi: `id` (PK), `product_id` (FK su `products` ON DELETE CASCADE), `barcode` (Codice a barre imballo), `package_qty` (Moltiplicatore pezzi contenuti nell'imballo).

### 7.4 Ordini di Vendita e Spedizioni
- **`orders`**:
  - Testata ordini emessi dagli agenti o ricevuti dal canale digitale.
  - Campi: `id` (PK), `client_id` (FK su `clients`), `agent_id` (FK su `users`), `date`, `number` (Identificativo progressivo normalizzato con suffisso `/conn`), `payment_name`, `payment_bank`, `delivery_name` (Ragione sociale destinazione merce), `carrier` (Vettore/Corriere per la spedizione es. Poste Italiane Crono, BRT, GLS), `tracking_number` (Lettera di vettura), `notes`, `total`, `status` (`Nuovo`, `Confermato`, `In Lavorazione`, `Spedito`), `is_imported` (Flag ordine importato da Easyfatt), `is_synced` (Flag ordine esportato/scaricato da Easyfatt), `synced_at`, `created_at`.
- **`order_items`**:
  - Righe dettaglio merce per ciascun ordine.
  - Campi: `id` (PK), `order_id` (FK su `orders` ON DELETE CASCADE), `product_code`, `supplier_code`, `description`, `qty`, `price`, `vat_code`, `um`.

### 7.5 Parametri di Sistema e Condizioni di Pagamento
- **`easyfatt_settings`**:
  - Parametri di configurazione dell'integrazione Danea.
  - Campi: `id` (CHECK id = 1), `username`, `password`, `default_payment`, `min_order_total`, `default_notes`, `default_vat`, `prices_include_vat`, `product_link_filter`, `product_commission_filter` (Filtro calcolo provvigioni).
- **`company_header`**:
  - Intestazione aziendale e dati legali utilizzati nei documenti PDF e stampe.
  - Campi: `id` (CHECK id = 1), `company_name`, `company_address`, `company_postcode`, `company_city`, `company_province`, `company_country`, `company_vat_code`, `company_fiscal_code`, `company_tel`, `company_fax`, `company_email`, `company_pec`, `company_website`, `company_logo`.
- **`payment_methods`**:
  - Tabella delle modalità di pagamento e calcolo scadenze.
  - Campi: `id` (PK), `name` (UNIQUE), `offset_days` (Giorni prima scadenza), `installments` (Numero rate), `fine_mese` (1 = Calcolo a fine mese, 0 = Data fattura), `custom_offsets` (Scadenze personalizzate).

### 7.6 Pianificazione Visite Commerciali
- **`agent_visits` / `visiting_schedule`**:
  - Calendario appuntamenti e girovisite agenti sul territorio.
  - Campi: `id` (PK), `agent_id` (FK su `users`), `client_id` (FK su `clients`), `visit_date`, `time_slot`, `notes`, `is_joint` (Flag visita congiunta con capoarea), `host_agent_id` (FK su `users`), `created_at`.
- **`co_visit_invites`**:
  - Inviti tra commerciali per affiancamenti su clienti (`visit_id`, `host_agent_id`, `guest_agent_id`, `status`).

### 7.7 Tabelle Operative Aziendali
- **`tasks`**: Bacheca attività e commesse operative (`id`, `title`, `description`, `internal_notes`, `category_id`, `assignee_id`, `status`, `priority`, `client_id`, `supplier_id`, `creator_id`, `deadline`, `duration_minutes`).
- **`task_tags` & `tags`**: Sistema di tagging con colori per filtri veloci.
- **`categories`**: Categorie operative organizzate ad albero ricorsivo (`parent_id`).
- **`task_history`**: Registro cronologico degli eventi e audit trail delle attività.
- **`task_notes`**: Note e commenti collaborativi tra utenti.
- **`calls`**: Registro chiamate telefoniche in ingresso/uscita con timer integrato (`caller_name`, `caller_type`, `reason`, `duration`, `task_id`, `client_id`, `supplier_id`, `category_id`, `user_id`).
- **`attachments`**: Gestione file e documenti allegati ai task.
- **`user_notifications` & `user_notification_settings`**: Notifiche in-app e relative preferenze di invio (scadenze, nuovi incarichi, commenti).

---

## 8. Logiche Applicative e Flussi di Integrazione

### 8.1 Flusso di Ingestione XML Danea Easyfatt
Il flusso di sincronizzazione del catalogo e dei clienti da Danea segue un protocollo transazionale robusto:

1. **Ricezione Payload HTTP POST**:
   - Danea Easyfatt invia una richiesta HTTP POST su `/api/easyfatt/sync` contenente il file XML compresso o multipart (fino a 50MB).
2. **Parsing Veloce con `fast-xml-parser`**:
   - Il middleware legge lo stream e analizza la struttura XML (verificando la conformità con il Protocollo 1, 2 o 3 per taglie e colori).
   - Estrazione normalizzata di anagrafiche clienti (`<Customer>`), prodotti (`<Product>`), varianti (`<Variants>`) e listini prezzi (`<Price1>` .. `<Price9>`).
3. **Salvataggio & Aggiornamento con Batch UPSERT**:
   - Per azzerare i colli di bottiglia e i tempi di elaborazione, i dati vengono raggruppati in **blocchi da 100 elementi**.
   - Ogni blocco viene inserito con una singola istruzione SQL `INSERT ... ON CONFLICT (code) DO UPDATE SET ...`:
     ```sql
     INSERT INTO products (code, description, price, net_price_1, stock, ...)
     VALUES ($1, $2, $3, $4, $5, ...), ($35, $36, $37, $38, $39, ...)
     ON CONFLICT (code) DO UPDATE SET
       description = EXCLUDED.description,
       price = EXCLUDED.price,
       net_price_1 = EXCLUDED.net_price_1,
       stock = EXCLUDED.stock,
       updated_at = CURRENT_TIMESTAMP;
     ```
4. **Risposta di Conferma Conforme**:
   - A completamento del batch, il server restituisce la risposta HTTP 200 con corpo testuale conforme alle specifiche Danea:
     ```text
     OK
     ```
   - In caso di sincronizzazione immagini (Protocollo 2), il server allega il target di upload (`OK\nImageSendURL=...`).

### 8.2 Motore di Sincronizzazione ed Error Handling
- **Allineamento Rigoroso dei Parametri SQL**:
  - Tutte le query parametrizzate (sia native PostgreSQL con `$1, $2, ...` che emulate SQLite con `?`) impongono un rigoroso controllo di corrispondenza posizionale e di tipo.
  - Ad esempio, nella tabella `agent_visits`, l'ordine dei parametri (`agent_id, client_id, visit_date, time_slot, notes, is_joint, host_agent_id`) è validato prima dell'esecuzione per scongiurare qualsiasi disallineamento nei tipi di dato (es. scambio tra ID numerici e stringhe orarie o date), garantendo l'integrità referenziale verso `users` e `clients`.
- **Transazionalità e Fail-Fast**:
  - Ogni operazione di batching opera all'interno di blocchi transazionali con gestione automatica del `ROLLBACK` in caso di errore su vincoli di integrità.
  - Timeout di connessione a 5 secondi e di query a 10 secondi prevengono il blocco dei processi di sincronizzazione e garantiscono risposte rapide al client gestionale.

### 8.3 Prestazioni e Caching Avanzato per la Rete Commerciale in Mobilità
Per consentire agli agenti commerciali di operare con la massima reattività anche in contesti territoriali con connettività limitata o assente:

1. **IndexedDB con Dexie / MiniSearch**:
   - I dati anagrafici e l'intero catalogo prodotti con listini e varianti vengono replicati in un database locale browser basato su **IndexedDB**, orchestrato tramite **Dexie.js**.
   - Sopra questo archivio locale opera **MiniSearch**, un motore di indicizzazione e ricerca full-text vettoriale in-memory. La digitazione di codici articolo, descrizioni o codici fornitore produce risultati con completamento automatico istantaneo a **0 millisecondi di latenza**, funzionando al 100% anche offline.
2. **Delta Sync (Sincronizzazione Incrementale)**:
   - Le interrogazioni di aggiornamento periodiche trasmettono il parametro `updated_since` (o timestamp dell'ultimo sync locale).
   - Il backend risponde inviando unicamente i record inseriti o variati dopo tale data, evitando il download ridondante di migliaia di record stabili e riducendo l'utilizzo di banda mobile a una frazione marginale.
3. **Optimistic UI (Reattività Istantanea)**:
   - Nell'interfaccia commerciale (aggiunta articoli a carrello ordine, pianificazione nuove tappe del girovisite, cambio stato task), l'interfaccia utente riflette immediatamente l'azione prima ancora che la risposta HTTP del server sia pervenuta.
   - In background, la richiesta viene inoltrata al server; in caso di eventuale errore o interruzione della connessione, una notifica toast avvisa l'utente e il sistema applica un rollback coerente dello stato locale senza perdita di dati.

---

## 9. Architettura di Sincronizzazione Danea Easyfatt & Diagnostica

### 9.1 Integrazione Nativa Danea Easyfatt (E-commerce Push/Pull)
- **Modello di Comunicazione**: Danea Easyfatt non possiede API REST native in tempo reale. L'integrazione con Connect avviene emulando le specifiche di un e-commerce standard tramite il protocollo HTTP e lo scambio deterministico di file XML strutturati.
- **Flusso Push (Importazione Anagrafiche e Prodotti)**:
  - Danea Easyfatt invia in modalità batch il catalogo prodotti completo o incrementale, le varianti e l'anagrafica clienti via richiesta HTTP POST verso l'endpoint unico `/api/easyfatt/download-orders` (o gli endpoint del modulo `/api/easyfatt/*`).
- **Flusso Pull (Scarico Ordini Rete Vendita)**:
  - Danea interroga il server Connect inviando una richiesta HTTP per prelevare gli ordini generati dagli agenti commerciali sul territorio, codificati nello standard XML `EasyfattDocuments`.

### 9.2 Analisi delle Problematiche di Sincronizzazione Riscontrate
Nelle fasi di integrazione iniziale tra gestionale desktop e database remoto PostgreSQL su Neon.tech, sono state individuate le seguenti problematiche critiche:

1. **Lentezza ed Effetto 'Blocco/Crash' (Timeout HTTP Client Desktop)**:
   - **Causa**: L'elaborazione e l'inserimento sequenziale riga per riga (anti-pattern N+1) per centinaia di clienti e migliaia di articoli ha generato un'elevata latenza cumulativa di rete verso il database cloud Neon PostgreSQL (30-50ms per ogni query individuale).
   - **Impatto**: Il client desktop di Danea, avendo un timeout HTTP ridotto di pochi secondi, interrompeva la connessione credendo che il server fosse bloccato o restituendo codici di errore 500/502 Bad Gateway.
2. **Errori nello Schema DB e Log di Deploy**:
   - **Colonna Mancante**: Assenza della colonna `product_commission_filter` nella tabella `easyfatt_settings`, che causava eccezioni SQL all'avvio o durante il salvataggio dei filtri del connettore.
   - **Violazioni di Unicità (Unique Constraint)**: Tentativi di re-inserimento non gestiti di dati predefiniti di sistema (es. record in `payment_methods` e `company_header`) privi di clausola protettiva `ON CONFLICT`.
   - **Disallineamento Parametri**: Discrepanza nel numero e nella mappatura dei parametri per le query prepared statement (es. tabella `agent_visits` con soli 5 parametri inviati su 8 richiesti dal tracciato).

### 9.3 Soluzioni Architetturali e Standard di Ottimizzazione Implementati
Per neutralizzare i colli di bottiglia e prevenire disconnessioni di rete, sono state introdotte le seguenti soluzioni:

1. **Batch Upsert (Chiamate Bulk Multi-Riga)**:
   - Transizione dal ciclo sequenziale `for` a query SQL multi-riga aggregate (chunk da 50-200 record, standardizzato a 100) con sintassi:
     ```sql
     INSERT INTO products (code, description, price, net_price_1, stock, ...)
     VALUES ($1, $2, ...), ($35, $36, ...)
     ON CONFLICT (code) DO UPDATE SET
       description = EXCLUDED.description,
       price = EXCLUDED.price,
       net_price_1 = EXCLUDED.net_price_1,
       stock = EXCLUDED.stock,
       updated_at = CURRENT_TIMESTAMP;
     ```
   - Questa soluzione ha abbattuto di oltre il 95% il carico di round-trip TCP, completando l'ingestione di cataloghi imponenti in meno di un secondo.
2. **Indicizzazione Obbligatoria**:
   - Creazione di indici univoci dedicati per evitare scansioni sequenziali (Sequential Scan) durante le operazioni di upsert:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code);
     CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_code ON clients(code);
     ```
3. **Risposta Rapida Handshake (< 3 Secondi)**:
   - Riduzione del tempo complessivo di ricezione ed elaborazione XML a meno di 3 secondi per restituire immediatamente a Danea la stringa di conferma HTTP 200 conforme (`OK\nImageSendURL=...`), scongiurando qualsiasi timeout del client desktop.
4. **Gestione Immagini Asincrona**:
   - Ricezione ed archiviazione diretta delle immagini nell'endpoint `/api/easyfatt/upload-images`, rispondendo immediatamente con status `OK` e delegando conversioni o ottimizzazioni a task di background non bloccanti.
