// DvarTorah persistence — a single SQLite table via Node's built-in node:sqlite.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Locally: data/ohr-hayom.db. On Vercel the project folder is read-only, so use the
// temporary folder — it is wiped when Vercel restarts the app, and the built-in library
// covers readers until new teachings are generated again.
function openDatabase() {
  try {
    if (process.env.VERCEL) return new DatabaseSync(join(tmpdir(), 'ohr-hayom.db'));
    const dir = new URL('../data/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    return new DatabaseSync(fileURLToPath(new URL('ohr-hayom.db', dir)));
  } catch (err) {
    console.error('Could not open the database file; keeping teachings in memory only.', err);
    return new DatabaseSync(':memory:');
  }
}

const db = openDatabase();

db.exec(`
  CREATE TABLE IF NOT EXISTS dvar_torah (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    for_date    TEXT NOT NULL,          -- the user's local day (YYYY-MM-DD)
    parsha_key  TEXT NOT NULL,          -- e.g. "Vayakhel" or "Vayakhel|Pekudei"
    content     TEXT NOT NULL,          -- JSON of the teaching
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_dvar_torah_day ON dvar_torah (for_date, parsha_key);
`);

const insertStmt = db.prepare('INSERT INTO dvar_torah (for_date, parsha_key, content) VALUES (?, ?, ?)');
const latestForDayStmt = db.prepare(
  'SELECT * FROM dvar_torah WHERE for_date = ? AND parsha_key = ? ORDER BY id DESC LIMIT 1',
);
const allStmt = db.prepare('SELECT * FROM dvar_torah ORDER BY id DESC');
const forParshaStmt = db.prepare('SELECT * FROM dvar_torah WHERE parsha_key = ? ORDER BY id DESC');
const countSinceStmt = db.prepare('SELECT COUNT(*) AS n FROM dvar_torah WHERE created_at >= ?');

function toEntity(row) {
  return row && { id: row.id, forDate: row.for_date, createdAt: row.created_at, ...JSON.parse(row.content) };
}

export function saveDvarTorah(forDate, parshaKey, content) {
  const { lastInsertRowid } = insertStmt.run(forDate, parshaKey, JSON.stringify(content));
  return toEntity(db.prepare('SELECT * FROM dvar_torah WHERE id = ?').get(lastInsertRowid));
}

export function findForDay(forDate, parshaKey) {
  return toEntity(latestForDayStmt.get(forDate, parshaKey));
}

export function listAll() {
  return allStmt.all().map(toEntity);
}

export function listForParsha(parshaKey) {
  return forParshaStmt.all(parshaKey).map(toEntity);
}

// Every row is one call to the model, so this is how many calls were made in the last 24 hours.
export function countGeneratedLast24h() {
  return countSinceStmt.get(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).n;
}
