const TOKEN_KEY = 'tcs_token';

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const uploadProgress = document.getElementById('upload-progress');
const fileList = document.getElementById('file-list');
const emptyState = document.getElementById('empty-state');

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

function showApp() {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  refreshFiles();
}

function showLogin() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(iso) {
  return new Date(`${iso}Z`).toLocaleString();
}

async function refreshFiles() {
  const res = await fetch('/api/files', { headers: authHeaders() });
  if (res.status === 401) {
    clearToken();
    showLogin();
    return;
  }
  const { files } = await res.json();
  renderFiles(files);
}

function renderFiles(files) {
  fileList.innerHTML = '';
  emptyState.hidden = files.length > 0;

  for (const file of files) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = file.name;

    const sizeCell = document.createElement('td');
    sizeCell.textContent = formatSize(file.size);

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(file.createdAt);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'secondary';
    downloadBtn.textContent = 'Unduh';
    downloadBtn.onclick = () => downloadFile(file);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'secondary';
    deleteBtn.textContent = 'Hapus';
    deleteBtn.onclick = () => deleteFile(file.id);

    actionsCell.append(downloadBtn, deleteBtn);
    row.append(nameCell, sizeCell, dateCell, actionsCell);
    fileList.append(row);
  }
}

async function downloadFile(file) {
  const res = await fetch(`/api/files/${file.id}/download`, { headers: authHeaders() });
  if (!res.ok) {
    alert('Gagal mengunduh file.');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteFile(id) {
  if (!confirm('Hapus file ini?')) return;
  await fetch(`/api/files/${id}`, { method: 'DELETE', headers: authHeaders() });
  refreshFiles();
}

async function uploadFiles(fileListArg) {
  for (const file of fileListArg) {
    const item = document.createElement('li');
    item.textContent = `Mengupload ${file.name}...`;
    uploadProgress.append(item);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload gagal');
      }
      item.textContent = `${file.name} berhasil diupload.`;
    } catch (err) {
      item.textContent = `${file.name}: ${err.message}`;
    } finally {
      setTimeout(() => item.remove(), 4000);
    }
  }
  refreshFiles();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    loginError.textContent = 'Password salah.';
    loginError.hidden = false;
    return;
  }
  const { token } = await res.json();
  setToken(token);
  showApp();
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  showLogin();
});

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

['dragenter', 'dragover'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  })
);

['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  })
);

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) {
    uploadFiles(e.dataTransfer.files);
  }
});

if (getToken()) {
  showApp();
} else {
  showLogin();
}
