const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.LBI_DB_PATH || path.join(__dirname, 'data', 'lbi.sqlite');

function openDb() {
  const db = new sqlite3.Database(DB_PATH);

  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );

    db.run(`CREATE INDEX IF NOT EXISTS idx_kv_updated_at ON kv(updated_at)`);
  });

  return db;
}

module.exports = {
  openDb,
  DB_PATH,
};
