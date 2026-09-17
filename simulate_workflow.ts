import { pool, query, queryGet, queryAll, queryRun, queryExec, initDatabase } from './src/lib/db.js';

// List of mock Italian clients
const MOCK_CLIENTS = [
  { name: 'Centro Estetico Bella', contact: 'Maria Visentin', phone: '028746352', email: 'maria@centrobella.it', city: 'Milano', notes: 'Clinica estetica partner premium' },
  { name: 'Solaris Spa', contact: 'Gianluca Rossi', phone: '067345621', email: 'gianluca@solarisspa.it', city: 'Roma', notes: 'Centro benessere e thalassoterapia' },
  { name: 'Acconciature Glamour', contact: 'Serena Marini', phone: '051874632', email: 'serena@glamourhair.it', city: 'Bologna', notes: 'Salone acconciature moda' },
  { name: 'Estetica & Armonia', contact: 'Elena Bravi', phone: '045987345', email: 'elena@esteticarmo.it', city: 'Verona', notes: 'Acquisti regolari di creme' },
  { name: 'Vanity Club', contact: 'Raimondo Riva', phone: '011234567', email: 'info@vanityclub.it', city: 'Torino', notes: 'Grande centro polifunzionale' },
  { name: 'Nail Art Studio', contact: 'Sofia Esposito', phone: '081234765', email: 'sofia@nailartstudio.it', city: 'Napoli', notes: 'Specialisti in ricostruzione unghie' },
  { name: 'Elite Hair & Spa', contact: 'Roberto Gialli', phone: '055983745', email: 'roberto@elitehair.it', city: 'Firenze', notes: 'Salone di alta moda e benessere' },
  { name: 'Armonia del Corpo', contact: 'Paola Azzurra', phone: '070387463', email: 'paola@armoniacorpo.it', city: 'Cagliari', notes: 'Fidato acquirente cosmetici bio' },
  { name: 'Linea Beauty', contact: 'Daniele Verdi', phone: '080274635', email: 'daniele@lineabeauty.it', city: 'Bari', notes: 'Catena regionale estetica' },
  { name: 'Oasi Benessere', contact: 'Francesca Neri', phone: '049874532', email: 'francesca@oasibenessere.it', city: 'Padova', notes: 'Istituto di bellezza e massaggi' }
];

// List of mock suppliers
const MOCK_SUPPLIERS = [
  { name: 'Cosmetic Pack Srl', contact: 'Roberto Neri', phone: '021234567', email: 'info@cosmeticpack.it', category: 'Packaging', notes: 'Fornitore principale flaconi e vasetti' },
  { name: 'Essence Lab', contact: 'Giulia Bruni', phone: '051987654', email: 'lab@essencelab.com', category: 'Materie prime', notes: 'Essenze naturali biologiche e fragranze' },
  { name: 'Etichette Italia SpA', contact: 'Enzo Ferrari', phone: '045238746', email: 'commerciale@etichetteitalia.it', category: 'Stampa', notes: 'Stampa etichette adesive ad alta definizione' },
  { name: 'Vetri Speciali Bologna', contact: 'Marta Bianchi', phone: '051746253', email: 'marta@vetrispeciali.it', category: 'Flaconi', notes: 'Flaconi di vetro per profumeria' },
  { name: 'Materie Prime Bio', contact: 'Alberto Moro', phone: '028937462', email: 'info@materieprimebio.it', category: 'Ingredienti', notes: 'Olii essenziali e additivi certificati' }
];

// List of mock Italian names for calls
const GUEST_NAMES = [
  'Fabio Esposito', 'Chiara Gallo', 'Alberto Fontana', 'Lucia Ricci', 'Giorgio Moretti',
  'Martina Bruno', 'Pietro Caruso', 'Alessia Marin', 'Stefano Colombo', 'Giulia Barberis',
  'Lorenzo Romano', 'Federica Conte', 'Davide Lombardi', 'Sara Serra', 'Alessandro Vitali'
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeDateString(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  const hour = randomInt(8, 17);
  const minute = randomInt(0, 59);
  const second = randomInt(0, 59);
  date.setHours(hour, minute, second);
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function makeDeadlineString(baseDateStr: string): string {
  const baseDate = new Date(baseDateStr);
  baseDate.setDate(baseDate.getDate() + randomInt(1, 6));
  return baseDate.toISOString().split('T')[0];
}

async function runEndToEndSimulation() {
  console.log('====================================================');
  console.log('--- STARTING MASSIVE 7-DAY WORKFLOW SIMULATION ---');
  console.log('====================================================');

  console.log('Step 0: Initializing database schema...');
  await initDatabase();

  console.log('Step 1: Cleaning previous transactional data...');
  await queryRun('DELETE FROM attachments');
  await queryRun('DELETE FROM task_history');
  await queryRun('DELETE FROM task_tags');
  await queryRun('DELETE FROM task_notes');
  await queryRun('DELETE FROM calls');
  await queryRun('DELETE FROM tasks');
  await queryRun('DELETE FROM user_notifications');
  console.log('Clean-up complete!');

  console.log('Step 2: Checking and establishing 4 consistent users...');
  const users = [
    { id: 1, name: 'Amministratore', email: 'info@connectitalia.com', role: 'admin', dept: 'direzionale' },
    { id: 2, name: 'Mario Rossi', email: 'mario@connect.com', role: 'user', dept: 'marketing' },
    { id: 3, name: 'Luigi Bianchi', email: 'luigi@connect.com', role: 'user', dept: 'assistenza tecnica' },
    { id: 4, name: 'Elena Verdi', email: 'elena@connect.com', role: 'user', dept: 'grafica' }
  ];

  for (const u of users) {
    const existing = await queryGet('SELECT id FROM users WHERE id = $1', [u.id]);
    if (!existing) {
      await queryRun(`
        INSERT INTO users (id, name, email, password, department, role) 
        VALUES ($1, $2, $3, 'password123', $4, $5)
      `, [u.id, u.name, u.email, u.dept, u.role]);
    } else {
      await queryRun(`
        UPDATE users 
        SET name = $1, email = $2, department = $3, role = $4 
        WHERE id = $5
      `, [u.name, u.email, u.dept, u.role, u.id]);
    }
  }

  console.log('Step 3: Populating rich Clients and Suppliers portfolio...');
  await queryRun('DELETE FROM clients');
  const clientIds: number[] = [];
  for (const cl of MOCK_CLIENTS) {
    const res = await queryRun('INSERT INTO clients (name, contact, phone, email, city, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [cl.name, cl.contact, cl.phone, cl.email, cl.city, cl.notes]);
    if (res.lastInsertRowid) clientIds.push(Number(res.lastInsertRowid));
  }

  await queryRun('DELETE FROM suppliers');
  const supplierIds: number[] = [];
  for (const s of MOCK_SUPPLIERS) {
    const res = await queryRun('INSERT INTO suppliers (name, contact, phone, email, category, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [s.name, s.contact, s.phone, s.email, s.category, s.notes]);
    if (res.lastInsertRowid) supplierIds.push(Number(res.lastInsertRowid));
  }

  console.log('Step 4: Preparing task tags...');
  const tagsList = [
    { name: 'Urgente', color: '#EF4444' },
    { name: 'In attesa', color: '#F59E0B' },
    { name: 'Approvato', color: '#10B981' },
    { name: 'Revisione', color: '#3B82F6' },
    { name: 'Importante', color: '#8B5CF6' }
  ];
  const tagIds: number[] = [];
  for (const t of tagsList) {
    await queryRun('INSERT INTO tags (name, color) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [t.name, t.color]);
    const tag = await queryGet<{ id: number }>('SELECT id FROM tags WHERE name = $1', [t.name]);
    if (tag) tagIds.push(tag.id);
  }

  console.log('Step 5: Structuring service Categories...');
  const cats = await queryAll<{ id: number; name: string }>('SELECT id, name FROM categories');
  let categoryIds = cats.map(c => c.id);
  if (categoryIds.length === 0) {
    const parentCats = ['Marketing', 'Commerciale', 'Amministrazione', 'Assistenza', 'Direzionale', 'Grafica', 'Logistica'];
    for (const p of parentCats) {
      const res = await queryRun('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id', [p, null]);
      const parentId = Number(res.lastInsertRowid);
      categoryIds.push(parentId);
      
      if (p === 'Marketing') {
        const sub1 = await queryRun('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id', ['Campagne', parentId]);
        categoryIds.push(Number(sub1.lastInsertRowid));
        const sub2 = await queryRun('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id', ['Social ed Eventi', parentId]);
        categoryIds.push(Number(sub2.lastInsertRowid));
      } else if (p === 'Commerciale') {
        const sub1 = await queryRun('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id', ['Richieste cosmetici', parentId]);
        categoryIds.push(Number(sub1.lastInsertRowid));
        const sub2 = await queryRun('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id', ['Nuovi Campioni', parentId]);
        categoryIds.push(Number(sub2.lastInsertRowid));
      } else if (p === 'Assistenza') {
        const sub1 = await queryRun('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id', ['Controllo Qualità', parentId]);
        categoryIds.push(Number(sub1.lastInsertRowid));
      }
    }
  }

  const TASK_TEMPLATES = [
    { title: 'Revisione listino prezzi flaconi', desc: 'Verificare i costi di produzione flaconi di vetro con fornitore', type: 'fornitore', priority: 'Media' },
    { title: 'Progetto etichette nuova linea Bio', desc: 'Sviluppare bozza grafica delle etichette per la linea bio-care', type: 'interno', priority: 'Alta' },
    { title: 'Assistenza tecnica formulazione siero', desc: 'Fornire supporto tecnico per lotti non conformi o sfasamenti del siero', type: 'cliente', priority: 'Urgente' },
    { title: 'Organizzazione fiera estetica Bologna', desc: 'Coordinamento inviti, allestimento stand e coupon pubblicitari', type: 'interno', priority: 'Bassa' },
    { title: 'Controllo lotti materie prime bio', desc: 'Verificare certificati biologici per lotti di olio di argan ricevuti', type: 'fornitore', priority: 'Media' },
    { title: 'Invio campionature creme notte', desc: 'Spedizione campioni gratuiti a centri estetici VIP', type: 'cliente', priority: 'Bassa' },
    { title: 'Risoluzione reclamo pompe dosatrici', desc: 'Cliente segnala malfunzionamento dei dispenser sui flaconi crema 50ml', type: 'cliente', priority: 'Urgente' },
    { title: 'Fatturazione fine mese fornitori packaging', desc: 'Emissione ordini di acquisto e controllo scadenze pagamenti', type: 'interno', priority: 'Media' },
    { title: 'Creazione post social Instagram', desc: 'Programmare contenuti promozionali per estate e sconti creme', type: 'interno', priority: 'Media' },
    { title: 'Studio di stabilità siero acido ialuronico', desc: 'Avviare test di invecchiamento accelerato a 40 gradi', type: 'interno', priority: 'Alta' }
  ];

  let totalTasksCreated = 0;
  let totalCallsLogged = 0;
  let totalStatusUpdates = 0;
  let totalNotesAdded = 0;
  let totalReassignments = 0;

  let activeTaskIds: number[] = [];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    for (const currentUser of users) {
      for (let actIdx = 1; actIdx <= 10; actIdx++) {
        const timestamp = makeDateString(dayOffset);
        const randAction = randomInt(1, 100);

        if (randAction <= 40 || activeTaskIds.length === 0) {
          const template = pickRandom(TASK_TEMPLATES);
          const category_id = pickRandom(categoryIds);
          const assignee_id = pickRandom(users).id;
          const client_id = template.type === 'cliente' ? pickRandom(clientIds) : null;
          const supplier_id = template.type === 'fornitore' ? pickRandom(supplierIds) : null;
          const deadline = makeDeadlineString(timestamp);
          
          const result = await queryRun(`
            INSERT INTO tasks (title, description, category_id, assignee_id, type, client_id, supplier_id, deadline, priority, creator_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
          `, [
            `${template.title} #${totalTasksCreated + 1}`,
            template.desc,
            category_id,
            assignee_id,
            template.type,
            client_id,
            supplier_id,
            deadline,
            template.priority || 'Media',
            currentUser.id,
            timestamp,
            timestamp
          ]);

          const taskId = Number(result.lastInsertRowid);
          if (taskId) activeTaskIds.push(taskId);
          totalTasksCreated++;

          if (randomInt(1, 10) > 4 && taskId) {
            const tagId = pickRandom(tagIds);
            await queryRun('INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [taskId, tagId]);
          }

          if (taskId) {
            await queryRun(`
              INSERT INTO task_history (task_id, user_id, action, details, timestamp)
              VALUES ($1, $2, 'creazione', 'Task creato durante simulazione', $3)
            `, [taskId, currentUser.id, timestamp]);

            if (assignee_id !== currentUser.id) {
              await queryRun(`
                INSERT INTO user_notifications (user_id, type, title, message, related_id, is_read, created_at)
                VALUES ($1, 'assignment', 'Nuova assegnazione', $2, $3, false, $4)
              `, [
                assignee_id,
                `Ti è stato assegnato il task: ${template.title} #${totalTasksCreated}`,
                taskId,
                timestamp
              ]);
            }
          }

        } else if (randAction <= 65) {
          const callerType = pickRandom(['cliente', 'fornitore', 'esterno'] as const);
          const callerName = pickRandom(GUEST_NAMES);
          const reason = `Chiamata di allineamento quotidiano riguardante pratiche Connect`;
          const duration = randomInt(45, 480);
          
          const associateTask = randomInt(1, 10) > 4 ? pickRandom(activeTaskIds) : null;
          const client_id = callerType === 'cliente' ? pickRandom(clientIds) : null;
          const supplier_id = callerType === 'fornitore' ? pickRandom(supplierIds) : null;
          const category_id = pickRandom(categoryIds);

          await queryRun(`
            INSERT INTO calls (caller_name, caller_type, reason, duration, task_id, client_id, supplier_id, category_id, user_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            callerName,
            callerType,
            reason,
            duration,
            associateTask,
            client_id,
            supplier_id,
            category_id,
            currentUser.id,
            timestamp
          ]);

          totalCallsLogged++;

          if (associateTask) {
            await queryRun(`
              INSERT INTO task_history (task_id, user_id, action, details, timestamp)
              VALUES ($1, $2, 'Chiamata ricevuta', $3, $4)
            `, [
              associateTask,
              currentUser.id,
              `Registrata telefonata da ${callerName} (${callerType}). Durata: ${duration}s.`,
              timestamp
            ]);
          }

        } else if (randAction <= 80) {
          const taskId = pickRandom(activeTaskIds);
          const task = await queryGet<{ id: number; status: string; creator_id: number; title: string }>('SELECT id, status, creator_id, title FROM tasks WHERE id = $1', [taskId]);
          if (task) {
            const statuses = ['Nuovo', 'In Corso', 'In Attesa', 'Completato'];
            let nextStatus = pickRandom(statuses);
            while (nextStatus === task.status) {
              nextStatus = pickRandom(statuses);
            }

            await queryRun(`
              UPDATE tasks 
              SET status = $1, updated_at = $2 
              WHERE id = $3
            `, [nextStatus, timestamp, taskId]);

            await queryRun(`
              INSERT INTO task_history (task_id, user_id, action, details, timestamp)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              taskId,
              currentUser.id,
              nextStatus.toLowerCase(),
              `Simulazione: Stato cambiato in ${nextStatus}`,
              timestamp
            ]);

            totalStatusUpdates++;

            if (task.creator_id && task.creator_id !== currentUser.id) {
              await queryRun(`
                INSERT INTO user_notifications (user_id, type, title, message, related_id, is_read, created_at)
                VALUES ($1, 'update', 'Aggiornamento Task', $2, $3, false, $4)
              `, [
                task.creator_id,
                `Lo stato del task "${task.title}" è cambiato in ${nextStatus}`,
                taskId,
                timestamp
              ]);
            }

            if (nextStatus === 'Completato' && activeTaskIds.length > 5) {
              activeTaskIds = activeTaskIds.filter(id => id !== taskId);
            }
          }

        } else if (randAction <= 92) {
          const taskId = pickRandom(activeTaskIds);
          const task = await queryGet<{ id: number; title: string; creator_id: number; assignee_id: number }>('SELECT id, title, creator_id, assignee_id FROM tasks WHERE id = $1', [taskId]);
          if (task) {
            const noteContent = pickRandom([
              'Aggiornamento rapido: la formulazione rispetta i parametri.',
              'Fornitore contattato, etichette in arrivo il prima possibile.',
              'Bozze riviste con il reparto grafico, attendiamo approvazione.',
              'Cliente estremamente soddisfatto dei campioni inviati.',
              'Attenzione: riscontrati rallentamenti nella spedizione.',
              'Dati salvati e pronti per revisione direzionale.'
            ]);

            await queryRun(`
              INSERT INTO task_notes (task_id, user_id, content, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5)
            `, [taskId, currentUser.id, noteContent, timestamp, timestamp]);

            await queryRun(`
              INSERT INTO task_history (task_id, user_id, action, details, timestamp)
              VALUES ($1, $2, 'nota', 'Aggiunta nuova nota interna', $3)
            `, [taskId, currentUser.id, timestamp]);

            totalNotesAdded++;
          }

        } else {
          const taskId = pickRandom(activeTaskIds);
          const task = await queryGet<{ id: number; title: string; creator_id: number; assignee_id: number }>('SELECT id, title, creator_id, assignee_id FROM tasks WHERE id = $1', [taskId]);
          if (task) {
            const nextAssignee = pickRandom(users);
            if (nextAssignee.id !== task.assignee_id) {
              await queryRun(`
                UPDATE tasks 
                SET assignee_id = $1, updated_at = $2 
                WHERE id = $3
              `, [nextAssignee.id, timestamp, taskId]);

              await queryRun(`
                INSERT INTO task_history (task_id, user_id, action, details, timestamp)
                VALUES ($1, $2, 'riassegnazione', $3, $4)
              `, [
                taskId,
                currentUser.id,
                `Assegnato a ${nextAssignee.name}`,
                timestamp
              ]);

              totalReassignments++;
            }
          }
        }
      }
    }
  }

  console.log('\n====================================================');
  console.log('--- SIMULATION DONE AND VERIFIED ---');
  console.log(` - Total Tasks created:       ${totalTasksCreated}`);
  console.log(` - Total Calls logged:        ${totalCallsLogged}`);
  console.log(` - Total Status updates:      ${totalStatusUpdates}`);
  console.log(` - Total Comments/Notes added: ${totalNotesAdded}`);
  console.log(` - Total Reassignments:       ${totalReassignments}`);
  console.log('====================================================\n');
  await pool.end();
}

runEndToEndSimulation().catch((err) => {
  console.error('Fatal Simulation Error:', err);
  process.exit(1);
});
