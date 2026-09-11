require('dotenv').config();

const path = require('path');
const { Readable } = require('stream');
const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');

const db = require('./db');
const telegram = require('./telegram');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: telegram.MAX_FILE_SIZE_BYTES },
});

const APP_PASSWORD = process.env.APP_PASSWORD;
if (!APP_PASSWORD) {
  throw new Error('APP_PASSWORD must be set in .env');
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

app.post('/api/login', (req, res) => {
  if (req.body?.password !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  res.json({ token: APP_PASSWORD });
});

app.get('/api/files', requireAuth, (req, res) => {
  const files = db.listFiles().map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    mimeType: f.mime_type,
    createdAt: f.created_at,
  }));
  res.json({ files });
});

app.post('/api/files', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });
  }

  try {
    const { telegramFileId, telegramMessageId } = await telegram.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const record = {
      id: nanoid(),
      name: req.file.originalname,
      size: req.file.size,
      mime_type: req.file.mimetype,
      telegram_file_id: telegramFileId,
      telegram_message_id: telegramMessageId,
    };
    db.insertFile(record);

    res.status(201).json({
      id: record.id,
      name: record.name,
      size: record.size,
      mimeType: record.mime_type,
    });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(502).json({ error: 'Failed to store file on Telegram', detail: err.message });
  }
});

app.get('/api/files/:id/download', requireAuth, async (req, res) => {
  const file = db.getFile(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const webStream = await telegram.getDownloadStream(file.telegram_file_id);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    Readable.fromWeb(webStream).pipe(res);
  } catch (err) {
    console.error('Download failed:', err);
    res.status(502).json({ error: 'Failed to fetch file from Telegram', detail: err.message });
  }
});

app.delete('/api/files/:id', requireAuth, async (req, res) => {
  const file = db.getFile(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  await telegram.deleteMessage(file.telegram_message_id);
  db.deleteFile(file.id);
  res.status(204).end();
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Telegram Bot API caps uploads at ${telegram.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Telegram cloud storage listening on http://localhost:${port}`);
});
