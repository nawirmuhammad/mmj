const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
  throw new Error(
    'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set. Copy .env.example to .env and fill them in.'
  );
}

const API_BASE = `https://api.telegram.org/bot${token}`;
const FILE_BASE = `https://api.telegram.org/file/bot${token}`;

// Cloud Bot API caps file size we can up/download this way.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

async function callApi(method, body) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    ...body,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error on ${method}: ${data.description || res.status}`);
  }
  return data.result;
}

async function uploadFile(buffer, filename, mimeType, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption || filename);
  form.append('document', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);

  const message = await callApi('sendDocument', { body: form });
  const doc = message.document;
  if (!doc) {
    throw new Error('Telegram did not return a document for the uploaded file');
  }
  return {
    telegramFileId: doc.file_id,
    telegramMessageId: message.message_id,
  };
}

async function getDownloadStream(telegramFileId) {
  const file = await callApi(
    'getFile',
    { body: new URLSearchParams({ file_id: telegramFileId }) }
  );
  const response = await fetch(`${FILE_BASE}/${file.file_path}`);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch file from Telegram (status ${response.status})`);
  }
  return response.body;
}

async function deleteMessage(telegramMessageId) {
  try {
    await callApi(
      'deleteMessage',
      { body: new URLSearchParams({ chat_id: chatId, message_id: String(telegramMessageId) }) }
    );
  } catch (err) {
    // Message may already be gone (e.g. manually deleted, or >48h old in some chat types).
    console.warn(`Could not delete Telegram message ${telegramMessageId}: ${err.message}`);
  }
}

module.exports = { uploadFile, getDownloadStream, deleteMessage, MAX_FILE_SIZE_BYTES };
