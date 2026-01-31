# 🤖 BOT WHATSAPP SEDERHANA 

Bot WhatsApp ringan dan cepat yang dibuat khusus untuk berjalan di **Termux**.
Menggunakan library `@whiskeysockets/baileys` yang stabil.

## ✨ Fitur 
1️⃣ *.sticker* / *.s*
   (Gambar/Video ➡️ Sticker)

2️⃣ *.download* / *.dl* <link>
   (YouTube/TikTok ➡️ Video MP4)
   *Note: Video bisa langsung diputar*

3️⃣ *.audio* / *.mp3* <link>
   (YouTube ➡️ Lagu/Audio MP3)

4️⃣ *.setpp*
   (Ganti PP Bot - Khusus Owner)

5️⃣ *.neofetch* / *.neo*
   (Info Server)

6️⃣ *.ping*
   (Cek Speed)

7️⃣ *.menu*
   (Daftar Menu)

## 📦 Cara Install di Termux (Lengkap & Anti Error)

Ikuti langkah ini satu per satu agar semua fitur (Downloader, Sticker) berjalan lancar.

### Update & Install Paket Utama
Kita membutuhkan Git, Node.js, FFmpeg (untuk sticker), Neofetch (untuk status), dan Python (untuk downloader).

### Langkah 1: Install Paket Sistem (Termux)
```bash
pkg update && pkg upgrade -y
git clone https://github.com/RIZZKUNNN/bot-wa-sederhana.git
cd bot-wa-sederhana
pkg install git nodejs ffmpeg libwebp python neofetch -y
```

### Langkah 2: Install yt-dlp (Python)
```bash
pip install yt-dlp
```

### Langkah 3: Install Paket Bot (Node.js)
```bash
npm install @whiskeysockets/baileys pino cheerio axios qrcode-terminal jimp --legacy-peer-deps
```
### Cara Install dan mengaktifkan bot
```bash
npm install
node index.js
