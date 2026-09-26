# Telegram Cloud Storage

Cloud file storage sederhana yang memakai Telegram sebagai backend penyimpanan.
File yang kamu upload dikirim sebagai dokumen ke sebuah chat/channel Telegram lewat
bot, sementara metadata (nama, ukuran, referensi file, folder) disimpan di SQLite
lokal supaya bisa dilist, diunduh, dan dihapus lagi lewat web UI. File juga bisa
dikelompokkan ke dalam folder (dan subfolder) untuk memudahkan navigasi.

## Cara kerja

1. Kamu upload file lewat web UI atau `POST /api/files`.
2. Server mengirim file itu ke chat Telegram yang kamu tentukan via Bot API
   (`sendDocument`), lalu menyimpan `file_id` + `message_id` yang dikembalikan
   Telegram ke SQLite (`data/storage.db`).
3. Saat kamu klik unduh, server mengambil URL file dari Telegram (`getFile`)
   lalu meneruskan (proxy) isinya ke browser kamu.
4. Saat dihapus, server menghapus pesan di Telegram dan menghapus baris
   metadata-nya.

Telegram jadi tempat penyimpanan file yang sesungguhnya; server ini hanya
index/gateway di depannya.

## Keterbatasan penting

- **Batas ukuran file**: Bot API versi cloud (yang dipakai di sini) membatasi
  upload/download bot maksimum **50MB per file**. Kalau butuh file lebih besar
  (sampai 2GB), kamu perlu menjalankan
  [Local Bot API Server](https://github.com/tdlib/telegram-bot-api) sendiri —
  di luar cakupan proyek ini.
- Ini bukan penyimpanan terenkripsi end-to-end; siapa pun yang punya akses ke
  chat Telegram tujuan juga bisa melihat filenya.
- Autentikasi web UI hanya berbasis satu shared password (`APP_PASSWORD`),
  cocok untuk pemakaian pribadi/tim kecil, bukan multi-user dengan role.

## Setup

### 1. Buat bot Telegram

1. Chat [@BotFather](https://t.me/BotFather) di Telegram, kirim `/newbot`,
   ikuti instruksinya.
2. Simpan token yang diberikan — ini nilai `TELEGRAM_BOT_TOKEN`.

### 2. Tentukan chat penyimpanan

Pilih salah satu:

- **DM pribadi**: kirim pesan apa saja ke bot kamu dulu (bot tidak bisa
  memulai chat duluan), lalu cari chat id kamu lewat
  [@userinfobot](https://t.me/userinfobot) atau endpoint
  `https://api.telegram.org/bot<token>/getUpdates`.
- **Grup/channel privat**: buat grup/channel privat, undang bot sebagai admin,
  lalu ambil chat id-nya (biasanya diawali `-100`) lewat `getUpdates` setelah
  mengirim pesan di grup tersebut.

Simpan sebagai `TELEGRAM_CHAT_ID`.

### 3. Konfigurasi environment

```bash
cp .env.example .env
```

Isi `.env`:

```
TELEGRAM_BOT_TOKEN=...   # dari BotFather
TELEGRAM_CHAT_ID=...     # dari langkah di atas
APP_PASSWORD=...         # password bebas untuk login ke web UI
PORT=3000
```

### 4. Install dependencies & jalankan

```bash
npm install
npm start
```

Buka `http://localhost:3000`, masukkan `APP_PASSWORD`, lalu mulai upload file.

## API

Semua endpoint (kecuali `/api/login`) butuh header
`Authorization: Bearer <APP_PASSWORD>`.

| Method | Path                       | Keterangan                          |
| ------ | -------------------------- | ------------------------------------ |
| POST   | `/api/login`               | `{ password }` → `{ token }`         |
| GET    | `/api/folders?parentId=`   | List subfolder dalam folder tsb (kosongkan `parentId` untuk root) |
| POST   | `/api/folders`             | `{ name, parentId? }` → buat folder baru |
| DELETE | `/api/folders/:id`         | Hapus folder (harus kosong, kalau tidak → 409) |
| GET    | `/api/files?folderId=`     | List file dalam folder tsb (kosongkan `folderId` untuk root) |
| POST   | `/api/files`               | Upload file (`multipart/form-data`, field `file`, opsional field `folderId`) |
| GET    | `/api/files/:id/download`  | Download file                        |
| DELETE | `/api/files/:id`           | Hapus file (dari Telegram + index)   |

## Struktur proyek

```
src/
  server.js    # Express app + routing API
  telegram.js  # Wrapper Bot API (upload, download, delete)
  db.js        # Metadata SQLite (better-sqlite3)
public/
  index.html, app.js, style.css   # Web UI statis
data/
  storage.db   # Dibuat otomatis saat pertama jalan
```
