# Technical Stack Documentation - Connect System (TECH_STACK.md)

## 1. Executive Summary & Core Platform
Il progetto **Connect** è una piattaforma integrata che combina funzionalità di **ERP**, **CRM**, **Task Management**, **Tracciamento Chiamate con Timer**, **Generatore Spedizioni Poste Italiane** e **Hub di Sincronizzazione Bidirezionale con Danea Easyfatt**.

- **Ambiente di Esecuzione**: Node.js (versione >= 20.0.0) containerizzato, pronto per Cloud Run, Railway o Docker standard.
- **Linguaggio**: TypeScript ~5.8.2 con strict type-checking sia sul frontend SPA che sul backend Express.
- **Architettura Applicativa**: Full-stack monorepo disaccoppiato logicamente:
  - **Frontend**: Single Page Application (SPA) reattiva ad altissime prestazioni.
  - **Backend**: Server API RESTful in Express.js integrato con middleware Vite in sviluppo e servito da file statici compilati in produzione.
  - **Porta di Rete**: Porta `3000` con binding su `0.0.0.0` e supporto proxy Nginx/Cloud Run.

---

## 2. Frontend: Single Page Application (SPA)
Il frontend è sviluppato secondo lo standard delle Single Page Application moderne, garantendo navigazione istantanea senza ricaricamenti di pagina, gestione dello stato reattivo e supporto offline/mobile-first per la rete vendita.

- **Framework Core**: **React 19** (`react` v19.0.0, `react-dom` v19.0.0).
  - Paradigma a componenti funzionali con Custom Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`).
  - Error Boundary specializzato (`AppGuard.tsx`) per prevenire crash totali dell'interfaccia.
- **Build Tool & Bundler**: **Vite 6** (`vite` v6.2.0, `@vitejs/plugin-react` v5.0.4).
  - Hot Module Replacement (HMR) ultra-veloce in locale.
  - Compilazione e minificazione ottimizzata per la produzione con code-splitting in `dist/`.
- **Routing Client-Side**: **React Router DOM v7** (`react-router-dom` v7.13.1).
  - Routing dichiarativo con gestione unificata di cronologia, parametri URL e guardie di navigazione reattive.
  - Transizioni di pagina fluide coordinate da `AnimatePresence`.
- **Design System & Styling**:
  - **Tailwind CSS v4** (`tailwindcss` v4.1.14, `@tailwindcss/vite` v4.1.14) configurato nativamente tramite plugin Vite e importazione globale `@import "tailwindcss";`.
  - **Class Utilities**: `clsx` (v2.1.1) e `tailwind-merge` (v3.5.0) combinati nell'helper universale `cn()` (`src/lib/utils.ts`).
  - **Palette Cromatica**: Design sobrio e professionale con sfondi neutri caldi (`#fcfaf7`, `#F5F5F0`), accenti eleganti (`#5A5A40`) e indicatori semantici per stati operativi.
- **Librerie di Supporto UI**:
  - **Iconografia**: **Lucide React** (`lucide-react` v0.546.0) per icone vettoriali uniformi e scalabili.
  - **Animazioni**: **Motion** (`motion` v12.23.24) per drawer laterali, modali a comparsa, indicatori di caricamento e toast.
  - **Generazione Documenti Client-Side**:
    - `jspdf` (v4.2.1) e `html2canvas` (v1.4.1) per l'anteprima e la stampa diretta in PDF di schede ordine, preventivi e fatture.
    - `xlsx` (SheetJS v0.18.5) per la manipolazione di fogli di calcolo lato client.

---

## 3. Backend: Architettura Server Applicativa
Il backend è un'architettura modulare costruita su Node.js ed Express.js con supporto simultaneo per chiamate AJAX da SPA, sincronizzazione XML automatizzata da software desktop e generazione reportistica.

- **Framework Server**: **Express.js** (`express` v4.21.2).
- **Tooling di Sviluppo & Produzione**:
  - `tsx` (v4.21.0) come runtime TypeScript on-the-fly per lo sviluppo.
  - `esbuild` (v0.28.1) per il bundling del file `server.ts` in un singolo file ESM/CJS eseguibile (`dist/server.js`).
- **Parsing e Payload**:
  - `express.json({ limit: '50mb' })` e `express.urlencoded({ extended: true, limit: '50mb' })` per gestire cataloghi Easyfatt corposi (migliaia di prodotti e varianti).
- **Gestione Upload & File Statici**:
  - **Multer** (`multer` v2.1.1) per il caricamento di immagini prodotto Easyfatt, allegati delle attività e file ZIP di backup nella cartella locale `/uploads/`.
  - Servizio statico express su `/uploads` per la distribuzione rapida delle immagini a catalogo.
- **Gestione XML e Compatibilità Danea**:
  - **fast-xml-parser** (v5.9.3) per la serializzazione e il parsing ad alta velocità dei protocolli Danea Easyfatt XML (Protocollo 1, 2 e 3 "Taglie e Colori").
  - `iconv-lite` (v0.7.3) per la conversione e decodifica di charset legacy.

---

## 4. Database & Persistence Architecture
L'architettura di persistenza opera direttamente su un database relazionale **PostgreSQL** (Neon.tech o istanza compatibile) tramite connection pool nativo ad alte prestazioni:

### 4.1 Database PostgreSQL Cloud & Locale
- **Driver di Connessione**: Pool PostgreSQL nativo (`pg` v8.22.0) con gestione delle credenziali da variabile d'ambiente `DATABASE_URL`.
- **Fail-Fast Configuration**: Configurazione del pool con timeout stringenti (`connectionTimeoutMillis: 5000`, `statement_timeout: 10000`) per prevenire blocchi e timeout nei reverse proxy.
- **Transazioni e Query Parametrizzate**: Tutte le operazioni utilizzano query parametrizzate posizionali `$1, $2, ...` e transazioni ACID sicure (`withTransaction`).
- **Batch Upsert Engine**:
  - Funzioni dedicate `upsertClientsBatchInPostgres` e `upsertProductsBatchInPostgres` in `src/lib/db.ts`.
  - Elaborazione in blocchi da **100 elementi** con query multi-riga `INSERT INTO ... ON CONFLICT (code) DO UPDATE SET ... RETURNING id, code`.
  - Riduzione del logging a un unico sommario aggregato per blocco (`[SYNC] Batch of X items processed...`), velocizzando di oltre il 90% l'elaborazione dei flussi XML Easyfatt.
- **Integrità Referenziale e Indici**: Vincoli espliciti di integrità relazionale (`ON DELETE CASCADE`, `ON DELETE SET NULL`) su ordini, righe ordine, pagamenti, note e task.

---

## 5. Sicurezza, Sessioni e RBAC (Role-Based Access Control)

### 5.1 Crittografia Password e Autenticazione
- **Password Hashing**: **bcryptjs** (`bcryptjs` v3.0.3) per la cifratura salata e la verifica sicura delle credenziali di accesso.
- **Sessioni e Cookie**:
  - **cookie-parser** (`cookie-parser` v1.4.7) per la firma e la lettura sicura dei cookie di sessione.
  - Configurazione cookie `userId` con opzioni `httpOnly: true`, `secure: true`, e `sameSite: 'none'`, garantendo compatibilità sia in iframe (Google Cloud Run / AI Studio) che in finestre browser autonome.
  - Supporto alternativo per intestazioni `Authorization: Bearer <token>` e `X-User-Id` per client API e sincronizzatori desktop.

### 5.2 Modello dei 4 Ruoli (RBAC)
Il sistema governa l'accesso ai moduli applicativi mappando rigorosamente 4 ruoli utente:
1. **Admin (`admin` / `amministratore`)**:
   - Accesso illimitato all'intero sistema.
   - Esclusività su: Gestione Utenti e Team (`/users`), Configurazione Parametri Easyfatt e Intestazione Aziendale (`/settings/admin`), Backup e Ripristino di sistema, Import massivo anagrafiche.
2. **User Base (`user`)**:
   - Personale operativo interno e backoffice.
   - Accesso a: Dashboard operativa (`/`), Gestione Attività e Task (`/tasks`), Rubrica Clienti (`/clients`), Rubrica Fornitori (`/suppliers`), Spedizioni Poste (`/poste-generator`), Profilo personale (`/settings/profile`), Stopwatch Chiamate.
   - Bloccato dall'accesso alle sezioni prettamente commerciali (es. reindirizzato lontano da `/girovisite`).
3. **Agente (`agent` / `agente`)**:
   - Consulente commerciale sul territorio.
   - Vista tattica semplificata su misura:
     - Calendario Visite e Appuntamenti (`/girovisite`).
     - Creazione Ordini con Showroom e Carrello Rapido (`/ordine` / `/crea-ordine`).
     - Clienti assegnati in esclusiva (`/clients`, filtrati per campo `agente`).
     - Consultazione Ordini e Catalogo Easyfatt (`/easyfatt`).
     - Monitoraggio Target e Statistiche (`/statistiche`).
   - **Guardie di Navigazione**: Blocco totale e reindirizzamento automatico a `/girovisite` al tentativo di accedere a `/`, `/tasks`, `/suppliers`, `/users`, `/poste-generator`.
4. **Capoarea (`capoarea`)**:
   - Responsabile di coordinamento vendite di zona.
   - Condivide l'interfaccia commerciale tattica dell'Agente (`isSalesRole`), con visibilità allargata sui clienti e sugli ordini degli agenti appartenenti alla propria area di competenza.
   - Stesse guardie di navigazione restrittive verso l'hub `/girovisite` per i moduli operativi interni non commerciali.

---

## 6. Moduli e Librerie Ausiliarie Core

| Modulo / Libreria | Versione | Ambito di Utilizzo |
| :--- | :--- | :--- |
| **adm-zip** | `^0.5.16` | Creazione, decompressione e gestione immediata in memoria di archivi ZIP durante i flussi di backup del database, esportazione log e pacchetti dati. |
| **archiver** | `^7.0.1` | Generazione ad alte prestazioni di archivi compressi ZIP in streaming continuo per il download di backup completi e allegati di grandi dimensioni. |
| **bcryptjs** | `^3.0.3` | Algoritmo di hashing e salt crittografico per la memorizzazione protetta delle password utente nel database. |
| **cookie-parser** | `^1.4.7` | Middleware Express per l'analisi e la validazione dei cookie HTTP di sessione con supporto per secret key firmata. |
| **exceljs** | `^4.4.0` | Generazione e formattazione avanzata di fogli di calcolo Excel XLSX con stili, intestazioni e celle validate per le distinte di spedizione Poste Italiane (Crono / Crono Express). |
| **fast-xml-parser** | `^5.9.3` | Motore di parsing e building bidirezionale XML per l'integrazione conforme con le specifiche Danea Easyfatt (file ordini, clienti e prodotti). |
| **recharts** | `^3.10.1` | Libreria di visualizzazione dati analitici per grafici a linee, barre e torte nelle pagine Dashboard e Statistiche Agenti. |
| **date-fns** | `^4.1.0` | Manipolazione, calcolo intervalli e formattazione date secondo gli standard ISO e convenzioni italiane. |

---

## 7. Configurazione e Gestione Dati Cloud (PostgreSQL su Neon.tech)

### 7.1 Connessione & Ambiente Cloud
- **Variabile d'Ambiente Primaria**: Connessione definita tramite `DATABASE_URI` (con fallback su `POSTGRES_URL` o `DATABASE_URL`).
- **Parametro SSL Obbligatorio**: È obbligatorio l'uso del parametro `?sslmode=verify-full` (o `sslmode=require` con certificati di trust) nelle URI di connessione cloud per garantire crittografia TLS end-to-end e protezione da attacchi man-in-the-middle.
- **Gestione Separata degli Endpoint (Direct vs Pooler)**:
  - **Endpoint Diretto (Direct Connection)**: Indispensabile per operazioni DDL, inizializzazione dello schema, migrazioni e comandi di lock transazionali, aggirando i limiti operativi dei proxy PgBouncer/Neon. Il runtime include un meccanismo di sanitizzazione automatica che trasforma gli hostname con suffisso `-pooler.` nel rispettivo endpoint diretto.
  - **Endpoint con Connection Pooler (PgBouncer)**: Raccomandato per l'operatività standard ad alta frequenza e transazioni veloci senza prepared statements complessi, massimizzando il throughput e prevenendo l'esaurimento delle connessioni contemporanee su istanze serverless.

### 7.2 Inizializzazione e Seeding Controllato (`isDatabaseCompletelyEmpty()`)
- **Logica di Salvaguardia Dati**: L'inizializzazione del database è regolata dalla funzione di controllo `isDatabaseCompletelyEmpty()`, la quale verifica se le tabelle primarie (es. `users`, `products`) contengono già record.
- **Prevenzione Sovrascritture**: Se il database risulta già popolato, la procedura di seeding iniziale (utenti demo, categorie predefinite, tag di sistema) viene completamente bypassata. In questo modo si garantisce che in ambienti di produzione o staging i dati reali non vengano mai sovrascritti o inquinati da fixture di test ad ogni riavvio del container.

### 7.3 Migrazioni Sicure e Non Distruttive
- **Politica DDL Idempotente**: Tutte le definizioni di tabelle e colonne utilizzano esclusivamente comandi SQL non distruttivi:
  - Creazione tabelle: `CREATE TABLE IF NOT EXISTS <tabella> (...)`.
  - Evoluzione dello schema: `ALTER TABLE <tabella> ADD COLUMN IF NOT EXISTS <colonna> <tipo>`.
  - Indici protetti: `CREATE INDEX IF NOT EXISTS` e `CREATE UNIQUE INDEX IF NOT EXISTS`.
- **Integrità Storica**: Nessuna operazione di avvio esegue comandi distruttivi (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`), garantendo zero downtime e piena retrocompatibilità dei dati esistenti durante i rilasci.

---

## 8. Tabelle e Schema Database (Danea Easyfatt Aligned)

Lo schema relazionale è specificamente modellato per garantire una corrispondenza bidirezionale esatta con le entità e gli attributi del tracciato Danea Easyfatt XML.

### 8.1 Anagrafiche e Sicurezza
- **`users`**: Profili del personale e della rete commerciale.
  - Campi: `id`, `name`, `email` (univoco), `password` (hash crittografico bcryptjs), `department`, `role` (`admin`, `agent` / `agente`, `amministrazione`, `user` base), `avatar`, `ical_token` (token univoco per feed calendario esterno), `created_at`.
- **`clients`**: Anagrafica clienti sincronizzata con Danea Easyfatt.
  - Campi: `id`, `code` (Codice cliente Danea univoco), `name`, `contact`, `phone`, `email`, `address`, `city`, `postcode`, `province`, `country`, `fiscal_code`, `vat_code`, `sdi_pec`, `cell_phone`, `fax`, `pec`, `delivery_name`, `delivery_address`, `delivery_postcode`, `delivery_city`, `delivery_province`, `delivery_country`, `price_list`, `payment_name`, `payment_bank`, `custom_field1..4`, `notes`, `agente` (assegnazione commerciale).
- **`suppliers`**: Registro fornitori aziendali.
  - Campi: `id`, `name`, `contact`, `phone`, `email`, `category`, `notes`.

### 8.2 Catalogo, Listini e Varianti (Protocollo 3)
- **`products`**: Catalogo prodotti e listini multipli allineati a Easyfatt.
  - Campi: `id`, `code` (Codice articolo Danea univoco), `description`, `price` (prezzo base), `net_price_1` .. `net_price_9` (listini prezzi netti), `gross_price_1` .. `gross_price_9` (listini prezzi lordi), `vat_code` (aliquota IVA), `um` (unità di misura), `stock` (giacenza magazzino), `min_stock`, `ordered_qty`, `category`, `subcategory`, `barcode`, `producer_name`, `supplier_code`, `supplier_name`, `supplier_product_code`, `supplier_net_price`, `supplier_gross_price`, `supplier_notes`, `classe_provvigione`, `image_file_name`, `notes`, `created_at`.
- **`product_variants`**: Gestione varianti Taglie e Colori (Protocollo 3 Danea).
  - Campi: `id`, `product_id` (FK su `products`), `size` (Taglia), `color` (Colore), `barcode` (Barcode specifico della variante), `available_qty`.
- **`product_extra_barcodes`**: Codici a barre addizionali e imballi.
  - Campi: `id`, `product_id` (FK su `products`), `barcode`, `package_qty` (quantità per confezione/imballo).

### 8.3 Ordini, Spedizioni e Condizioni Commerciali
- **`orders`**: Testata ordini raccolti dalla rete vendita o importati.
  - Campi: `id`, `client_id` (FK su `clients`), `agent_id` (FK su `users`), `date`, `number` (con suffisso automatico `/conn`), `payment_name`, `payment_bank`, `delivery_name`, `carrier` (vettore di spedizione), `tracking_number`, `notes`, `total`, `status` (`Nuovo`, `Confermato`, `In Lavorazione`, `Spedito`), `is_imported`, `is_synced`, `synced_at`, `created_at`.
- **`order_items`**: Righe dettaglio dell'ordine.
  - Campi: `id`, `order_id` (FK su `orders`), `product_code`, `supplier_code`, `description`, `qty`, `price`, `vat_code`, `um`.
- **`payment_methods`**: Termini e condizioni di pagamento.
  - Campi: `id`, `name` (univoco), `offset_days` (giorni dilazione), `installments` (numero rate), `fine_mese` (flag calcolo scadenza a fine mese), `custom_offsets`.
- **`easyfatt_settings` & `company_header`**:
  - `easyfatt_settings`: Configurazione connettore Danea (`id=1`, `username`, `password`, `default_payment`, `min_order_total`, `default_notes`, `default_vat`, `prices_include_vat`, `product_link_filter`, `product_commission_filter`).
  - `company_header`: Dati fiscali e intestazione aziendale per documenti e PDF (`company_name`, `company_address`, `company_postcode`, `company_city`, `company_province`, `company_country`, `company_vat_code`, `company_fiscal_code`, `company_tel`, `company_email`, `company_pec`, `company_website`, `company_logo`).

### 8.4 Girovisite e Pianificazione Commerciale
- **`agent_visits` / `visiting_schedule`**: Appuntamenti e pianificazione visite.
  - Campi: `id`, `agent_id` (FK su `users`), `client_id` (FK su `clients`), `visit_date`, `time_slot`, `notes`, `is_joint` (flag visita congiunta), `host_agent_id` (agente ospitante), `created_at`.
- **`co_visit_invites`**: Inviti e affiancamenti tra agenti e capoarea (`visit_id`, `host_agent_id`, `guest_agent_id`, `status`).

### 8.5 Moduli Operativi di Collaborazione
- **`tasks`**: Attività aziendali con scadenze e priorità (`title`, `description`, `internal_notes`, `category_id`, `assignee_id`, `status`, `priority`, `client_id`, `supplier_id`, `creator_id`, `deadline`, `duration_minutes`).
- **`task_tags` & `tags`**: Etichettatura trasversale delle attività (`task_id`, `tag_id`, nome tag, colore esadecimale).
- **`categories`**: Struttura ad albero gerarchica con `parent_id` ricorsivo.
- **`task_history`**: Audit trail completo degli avanzamenti (`task_id`, `user_id`, `action`, `details`, `timestamp`).
- **`task_notes`**: Commenti e note interne riservate con tracking autore.
- **`calls`**: Registro chiamate telefoniche con calcolo durata da cronometro live (`caller_name`, `caller_type`, `reason`, `duration`, `task_id`, `client_id`, `supplier_id`, `category_id`, `user_id`).
- **`attachments`**: Allegati documentali collegati ai task (`task_id`, `file_name`, `file_path`, `file_type`).
- **`user_notifications` & `user_notification_settings`**: Centro notifiche in-app e preferenze avvisi per singolo utente.

---

## 9. Prestazioni, Caching Avanzato & Strategie Offline

### 9.1 IndexedDB con Dexie & Ricerche Istantanee con MiniSearch
- **Architettura Offline-First a Latenza 0ms**: Per consentire agli agenti commerciali di consultare cataloghi con decine di migliaia di articoli e anagrafiche sul campo anche in assenza di rete, i dati vengono memorizzati localmente in **IndexedDB** gestito tramite **Dexie**.
- **Indice Full-Text MiniSearch**: Motore di ricerca testuale client-side in-memory che indicizza istantaneamente codice articolo, codice a barre, fornitore e descrizione, abilitando il completamento automatico e la ricerca con tolleranza d'errore tipografico a zero millisecondi.

### 9.2 Delta Sync (Sincronizzazione Incrementale)
- **Meccanismo `updated_since`**: Il frontend e i servizi di background non scaricano l'intero archivio ad ogni aggiornamento, ma richiedono unicamente i record creati o modificati successivamente all'ultimo timestamp registrato (`/api/products?updated_since=...`, `/api/clients?updated_since=...`).
- **Minimizzazione del Traffico**: Riduzione drastica del consumo di banda su connessioni 4G/5G mobili e azzeramento del carico computazionale sul database server.

### 9.3 Optimistic UI (Aggiornamento Immediato dell'Interfaccia)
- **Reattività Immediata**: Tutte le operazioni chiave (aggiunta articoli a carrello ordine, cambio stato appuntamento in girovisite, spunta checklist attività) aggiornano lo stato locale dell'interfaccia istantaneamente prima di attendere la risposta HTTP del server.
- **Rollback Transazionale Client-Side**: In caso di errore o timeout di rete, il sistema notifica l'utente con un toast discreto e ripristina lo stato precedente senza bloccare il flusso di lavoro commerciale.

---

## 10. Architettura di Sincronizzazione Danea Easyfatt & Diagnostica

### 10.1 Integrazione Nativa Danea Easyfatt (E-commerce Push/Pull)
- **Modello di Comunicazione**: Danea Easyfatt non dispone di API REST native in tempo reale o webhook asincroni. L'architettura integra il gestionale desktop simulando un endpoint e-commerce standard conforme alle specifiche Danea attraverso il protocollo HTTP e lo scambio deterministico di file XML.
- **Flusso Push (Importazione Anagrafiche e Prodotti)**:
  - Il gestionale Danea Easyfatt avvia una procedura guidata o pianificata di sincronizzazione catalogo verso il web.
  - I dati (schede prodotto, varianti taglie/colori, codici a barre, listini 1-9, giacenze magazzino e anagrafiche clienti con destinazioni merce) vengono aggregati in pacchetti XML e trasmessi via HTTP POST multipart verso l'endpoint unico `/api/easyfatt/download-orders` (o endpoint dedicati del modulo `/api/easyfatt/*`).
- **Flusso Pull (Scarico Ordini Agenti)**:
  - Danea interroga periodicamente o su richiesta dell'operatore il server Connect inviando una richiesta HTTP GET/POST per prelevare i nuovi ordini e le commissioni raccolte dalla rete agenti sul territorio.
  - Il server Connect genera dinamicamente il tracciato conforme `EasyfattDocuments`, marcando gli ordini estratti come sincronizzati (`is_synced = 1`, `synced_at = NOW()`).

### 10.2 Analisi delle Problematiche di Sincronizzazione Riscontrate
Durante le prime fasi di testing con cataloghi reali su larga scala (migliaia di prodotti e clienti) collegati a un'istanza PostgreSQL remota su Neon.tech, sono emerse criticità specifiche che hanno richiesto interventi mirati:

1. **Lentezza ed Effetto 'Blocco/Crash' (Timeout HTTP Client Danea)**:
   - **Causa Radice**: L'elaborazione iniziale operava con un ciclo sequenziale riga per riga (anti-pattern N+1). L'esecuzione di centinaia o migliaia di singole query `SELECT` e `UPDATE`/`INSERT` seriali su connessione di rete remota (con latenza TCP di 30-50ms per round-trip verso Neon) accumulava tempi di risposta di oltre 60-120 secondi.
   - **Impatto Operativo**: Il software desktop Danea Easyfatt adotta un timeout HTTP rigido di pochi secondi per singola richiesta. Superata tale soglia, il client interrompeva bruscamente la connessione, segnalando all'utente falsi errori di "Server non raggiungibile", "Errore 500" o "Bad Gateway 502", lasciando il database in uno stato transazionale interrotto o parziale.
2. **Errori nello Schema DB e Log di Deploy**:
   - **Colonna Mancante**: Assenza della colonna `product_commission_filter` all'interno della tabella `easyfatt_settings`, con conseguente eccezione SQL in fase di salvataggio delle preferenze del connettore.
   - **Violazioni di Unicità (Unique Constraint Violation)**: Re-inserimenti non controllati di record di sistema predefiniti (es. righe di configurazione singola in `payment_methods` o `company_header`) senza clausole di protezione `ON CONFLICT`, che causavano il fallimento dell'intero bootstrap applicativo.
   - **Disallineamento Parametri Prepared Statement**: Discrepanze tra i segnaposto numerati e i valori effettivamente passati alle query SQL (ad esempio, nella tabella `agent_visits`, con soli 5 parametri valorizzati a fronte degli 8 richiesti dalla query parametrizzata), provocando errori irreversibili di esecuzione query su PostgreSQL.

### 10.3 Soluzioni Architetturali e Standard di Ottimizzazione Implementati
Per risolvere in modo definitivo le criticità riscontrate e garantire affidabilità industriale al flusso di sincronizzazione, sono stati implementati i seguenti standard architetturali:

1. **Batch Upsert Ad Alte Prestazioni (Bulk Chunks)**:
   - Eliminazione totale del ciclo sequenziale riga-per-riga a favore di query multi-riga aggregate elaborate in chunk da **50 a 200 record** (standard: 100 elementi per blocco).
   - Sintassi SQL nativa ad alta efficienza:
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
   - Questa transizione ha abbattuto di oltre il 95% il numero di round-trip di rete verso Neon, riducendo l'elaborazione di migliaia di anagrafiche da vari minuti a frazioni di secondo.
2. **Indicizzazione Obbligatoria su Chiavi di Riconciliazione**:
   - Creazione di indici univoci dedicati sia in ambiente PostgreSQL che in SQLite:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(code);
     CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_code ON clients(code);
     ```
   - L'indicizzazione mirata evita il degradamento delle prestazioni da Scansione Sequenziale (Sequential Scan) durante le operazioni di `ON CONFLICT (code)`, garantendo tempi di ricerca e match costanti $O(1)$ o $O(\log N)$.
3. **Risposta Rapida all'Handshake Danea**:
   - Ottimizzazione del ciclo di parsing XML e aggregazione memoria per contenere l'elaborazione iniziale entro **meno di 3 secondi**, restituendo immediatamente a Danea Easyfatt la risposta di conferma conforme:
     ```text
     OK
     ImageSendURL=https://<dominio>/api/easyfatt/upload-images
     ```
   - Questo azzera totalmente i timeout del client desktop, consentendo il passaggio immediato al download ordini o all'invio asincrono dei binari grafici.
4. **Gestione Immagini Asincrona e Non Bloccante**:
   - L'endpoint dedicato `/api/easyfatt/upload-images` riceve i file grafici inviati da Danea tramite Multer, li memorizza direttamente nel file system locale o storage containerizzato (`/uploads/`) e restituisce istantaneamente lo status HTTP `OK`.
   - Qualsiasi eventuale elaborazione accessoria, generazione di miniature o calcolo hash viene delegata a code di background asincrone, impedendo a file immagine ad alta risoluzione di rallentare o bloccare la sincronizzazione dei dati contabili e commerciali.
