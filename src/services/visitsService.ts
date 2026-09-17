import { pool } from '../lib/db.ts';

export interface CreateVisitInput {
  agent_id: number;
  client_id: number;
  visit_date: string;
  time_slot?: string;
  notes?: string;
}

/**
 * Inserts a new agent visit into PostgreSQL.
 * Exactly 5 arguments align with the 5 placeholders ($1..$5).
 */
export async function createAgentVisit(
  agent_id: number,
  client_id: number,
  visit_date: string,
  time_slot: string = '09:00',
  notes: string = ''
) {
  const query = `
    INSERT INTO agent_visits (agent_id, client_id, visit_date, time_slot, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const params = [agent_id, client_id, visit_date, time_slot, notes];
  const result = await pool.query(query, params);
  return result.rows[0];
}

export async function getVisitsByAgent(agentId: number) {
  const query = `
    SELECT v.*, 
           c.name as client_name, c.address as client_address, c.city as client_city, 
           c.contact as client_contact, c.phone as client_phone, c.email as client_email, c.agente as client_agente,
           u.name as agent_name
    FROM agent_visits v
    LEFT JOIN clients c ON v.client_id = c.id
    LEFT JOIN users u ON v.agent_id = u.id
    WHERE v.agent_id = $1
    ORDER BY v.visit_date DESC, v.time_slot ASC
  `;
  const result = await pool.query(query, [agentId]);
  return result.rows;
}

export async function deleteAgentVisit(visitId: number) {
  const query = `DELETE FROM agent_visits WHERE id = $1 RETURNING *`;
  const result = await pool.query(query, [visitId]);
  return result.rows[0];
}
