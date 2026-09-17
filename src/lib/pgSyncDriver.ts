import { Worker } from 'worker_threads';
import { getConnectionString } from './db.ts';

// 32MB SharedArrayBuffer for synchronous IPC between main thread and Postgres worker
const BUFFER_SIZE = 32 * 1024 * 1024;
const sab = new SharedArrayBuffer(BUFFER_SIZE);
const int32 = new Int32Array(sab);

// State flags:
// int32[0]: 0 = IDLE, 1 = PENDING_REQUEST, 2 = RESPONSE_READY, 3 = ERROR
// int32[1]: request type / status
// int32[2]: payload length in bytes

export function formatQuery(sql: string): string {
  let paramIdx = 1;
  return sql.replace(/\?/g, () => `$${paramIdx++}`);
}

export function sanitizeSql(sql: string): string {
  let s = sql.trim();
  if (/^PRAGMA/i.test(s)) return 'SELECT 1';

  s = s.replace(/datetime\s*\(\s*'now'\s*,\s*'-30 hours'\s*\)/gi, "(NOW() - INTERVAL '30 hours')");
  s = s.replace(/datetime\s*\(\s*'now'\s*\)/gi, "NOW()");
  s = s.replace(/DATE\s*\(\s*'now'\s*,\s*'\+1 day'\s*\)/gi, "(CURRENT_DATE + INTERVAL '1 day')");
  s = s.replace(/DATE\s*\(\s*'now'\s*,\s*'-?(\d+)\s+day[s]?'\s*\)/gi, "(CURRENT_DATE + INTERVAL '$1 day')");
  s = s.replace(/DATE\s*\(\s*'now'\s*\)/gi, "CURRENT_DATE");
  s = s.replace(/DATE\s*\(\s*deadline\s*,\s*'\+1 day'\s*\)/gi, "(deadline::date + INTERVAL '1 day')");
  s = s.replace(/DATE\s*\(\s*deadline\s*\)/gi, "deadline::date");
  s = s.replace(/MAX\s*\(\s*0\s*,\s*stock\s*-\s*\?\s*\)/gi, 'GREATEST(0, stock - ?)');

  // Boolean column sanitization for PostgreSQL compatibility
  s = s.replace(/\bonline_customized\s*=\s*0\b/gi, 'online_customized = false');
  s = s.replace(/\bonline_customized\s*=\s*1\b/gi, 'online_customized = true');
  s = s.replace(/\bmanage_warehouse\s*=\s*0\b/gi, 'manage_warehouse = false');
  s = s.replace(/\bmanage_warehouse\s*=\s*1\b/gi, 'manage_warehouse = true');
  s = s.replace(/\bis_imported\s*=\s*0\b/gi, 'is_imported = false');
  s = s.replace(/\bis_imported\s*=\s*1\b/gi, 'is_imported = true');
  s = s.replace(/\bis_read\s*=\s*0\b/gi, 'is_read = false');
  s = s.replace(/\bis_read\s*=\s*1\b/gi, 'is_read = true');

  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+/gi, 'INSERT INTO ');
    if (!/ON\s+CONFLICT/i.test(s)) {
      if (/INTO\s+["`]?tags["`]?\b/i.test(s)) {
        s += ' ON CONFLICT (name) DO NOTHING';
      } else if (/INTO\s+["`]?payment_methods["`]?\b/i.test(s)) {
        s += ' ON CONFLICT (name) DO NOTHING';
      } else {
        s += ' ON CONFLICT DO NOTHING';
      }
    }
  }

  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+/gi, 'INSERT INTO ');
    if (!/ON\s+CONFLICT/i.test(s)) {
      s += ' ON CONFLICT DO NOTHING';
    }
  }

  return s;
}

const workerScript = `
  const { parentPort, workerData } = require('worker_threads');
  const { Pool } = require('pg');

  const int32 = new Int32Array(workerData.sab);
  const uint8 = new Uint8Array(workerData.sab, 16);

  const pool = new Pool({
    connectionString: workerData.connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000
  });

  pool.on('error', (err) => {
    console.error('[PG Pool Idle Client Error]', err?.message || err);
  });

  parentPort.on('message', async (req) => {
    try {
      let querySql = req.sql;
      const isInsert = /^INSERT\\s+/i.test(querySql.trim());
      
      let res;
      if (isInsert && !/RETURNING/i.test(querySql) && !/ON\\s+CONFLICT\\s+DO\\s+NOTHING/i.test(querySql)) {
        try {
          res = await pool.query(querySql + ' RETURNING *', req.params || []);
        } catch (e) {
          // If RETURNING * fails (e.g. table without columns), retry without RETURNING
          res = await pool.query(querySql, req.params || []);
        }
      } else {
        res = await pool.query(querySql, req.params || []);
      }

      let lastInsertRowid = 0;
      if (res.rows && res.rows.length > 0) {
        lastInsertRowid = res.rows[0].id || res.rows[0].rowid || 0;
      }

      const result = {
        ok: true,
        rows: res.rows || [],
        rowCount: res.rowCount || 0,
        lastInsertRowid: Number(lastInsertRowid) || 0
      };

      const encoded = Buffer.from(JSON.stringify(result));
      if (encoded.length > workerData.bufferSize - 32) {
        throw new Error('Result set exceeded IPC buffer size');
      }

      encoded.copy(uint8);
      int32[2] = encoded.length;
      Atomics.store(int32, 0, 2);
      Atomics.notify(int32, 0, 1);
    } catch (err) {
      const errRes = JSON.stringify({ ok: false, error: err?.message || String(err) });
      const encoded = Buffer.from(errRes);
      encoded.copy(uint8);
      int32[2] = encoded.length;
      Atomics.store(int32, 0, 3);
      Atomics.notify(int32, 0, 1);
    }
  });
`;

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    const connectionString = getConnectionString();
    worker = new Worker(workerScript, {
      eval: true,
      workerData: {
        sab,
        connectionString,
        bufferSize: BUFFER_SIZE
      }
    });
    // Unref so worker doesn't keep node alive if main thread exits
    worker.unref();
  }
  return worker;
}

function executeSync(type: 'all' | 'get' | 'run' | 'exec', rawSql: string, params: any[] = []): any {
  const trimmed = rawSql.trim();
  if (/^PRAGMA/i.test(trimmed)) {
    if (type === 'get') return undefined;
    if (type === 'all') return [];
    return { changes: 0, lastInsertRowid: 0 };
  }

  const sanitized = sanitizeSql(trimmed);
  const pgSql = formatQuery(sanitized);
  const w = getWorker();

  Atomics.store(int32, 0, 1);
  w.postMessage({ type, sql: pgSql, params });

  // Wait for worker response
  Atomics.wait(int32, 0, 1);

  const len = int32[2];
  const buf = Buffer.from(sab, 16, len);
  const res = JSON.parse(buf.toString('utf8'));

  if (!res.ok) {
    throw new Error(`[Postgres Sync Driver Error] ${res.error} (Query: "${pgSql.substring(0, 120)}")`);
  }

  if (type === 'get') {
    return res.rows[0];
  }
  if (type === 'all') {
    return res.rows;
  }
  return {
    changes: res.rowCount,
    lastInsertRowid: res.lastInsertRowid
  };
}

function normalizeParams(args: any[]): any[] {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

export interface Statement {
  all(...params: any[]): any[];
  get(...params: any[]): any;
  run(...params: any[]): { changes: number; lastInsertRowid: number };
}

export class PostgresSyncDatabase {
  prepare(sql: string): Statement {
    return {
      all: (...args: any[]) => executeSync('all', sql, normalizeParams(args)),
      get: (...args: any[]) => executeSync('get', sql, normalizeParams(args)),
      run: (...args: any[]) => executeSync('run', sql, normalizeParams(args))
    };
  }

  exec(sql: string): void {
    // Split multi-statement scripts if needed, or execute directly
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      if (/^PRAGMA/i.test(stmt)) continue;
      executeSync('run', stmt);
    }
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      executeSync('run', 'BEGIN');
      try {
        const result = fn(...args);
        executeSync('run', 'COMMIT');
        return result;
      } catch (err) {
        try {
          executeSync('run', 'ROLLBACK');
        } catch (_) {}
        throw err;
      }
    }) as T;
  }

  pragma(pragmaStr: string): any {
    return undefined;
  }

  close(): void {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }
}

// Export a singleton instance compatible with the better-sqlite3 `db` API
export const pgDb = new PostgresSyncDatabase();
export default pgDb;
