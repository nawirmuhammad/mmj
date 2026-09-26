const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'storage.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT,
    telegram_file_id TEXT NOT NULL,
    telegram_message_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration for databases created before folder support existed.
const fileColumns = db.prepare('PRAGMA table_info(files)').all();
if (!fileColumns.some((c) => c.name === 'folder_id')) {
  db.exec('ALTER TABLE files ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE');
}

function createFolder(folder) {
  db.prepare(`
    INSERT INTO folders (id, name, parent_id)
    VALUES (@id, @name, @parent_id)
  `).run(folder);
}

function listFolders(parentId) {
  if (parentId) {
    return db.prepare('SELECT * FROM folders WHERE parent_id = ? ORDER BY name').all(parentId);
  }
  return db.prepare('SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name').all();
}

function getFolder(id) {
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
}

function folderHasChildren(id) {
  const subfolder = db.prepare('SELECT 1 FROM folders WHERE parent_id = ? LIMIT 1').get(id);
  const file = db.prepare('SELECT 1 FROM files WHERE folder_id = ? LIMIT 1').get(id);
  return Boolean(subfolder || file);
}

function deleteFolder(id) {
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
}

function insertFile(file) {
  db.prepare(`
    INSERT INTO files (id, name, size, mime_type, telegram_file_id, telegram_message_id, folder_id)
    VALUES (@id, @name, @size, @mime_type, @telegram_file_id, @telegram_message_id, @folder_id)
  `).run(file);
}

function listFiles(folderId) {
  if (folderId) {
    return db.prepare('SELECT * FROM files WHERE folder_id = ? ORDER BY created_at DESC').all(folderId);
  }
  return db.prepare('SELECT * FROM files WHERE folder_id IS NULL ORDER BY created_at DESC').all();
}

function getFile(id) {
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

function deleteFile(id) {
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
}

module.exports = {
  createFolder,
  listFolders,
  getFolder,
  folderHasChildren,
  deleteFolder,
  insertFile,
  listFiles,
  getFile,
  deleteFile,
};
