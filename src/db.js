const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'storage.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT,
    telegram_file_id TEXT NOT NULL,
    telegram_message_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function insertFile(file) {
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, telegram_file_id, telegram_message_id)
    VALUES (@id, @name, @size, @mime_type, @telegram_file_id, @telegram_message_id)
  `).run(file);
}

function listFiles() {
  return db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
}

function getFile(id) {
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

function deleteFile(id) {
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
}

module.exports = { insertFile, listFiles, getFile, deleteFile };
