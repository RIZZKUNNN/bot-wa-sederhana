# 🤖 BOT WHATSAPP TERMUX (V17 - Clean Edition)

Bot WhatsApp ringan dan cepat yang dibuat khusus untuk berjalan di **Termux**.
Menggunakan library `@whiskeysockets/baileys` yang stabil.

## ✨ Fitur Unggulan

### 🎬 Anime & Donghua (Scraping)
- **.animexin <judul>** : Cari & Update terbaru Donghua (Anime China).
- **.otakudesu <judul>** : Cari Anime & Episode On-Going.
- **.kusonime <judul>** : Cari Anime Batch (Langsung tamat).

### 🛠️ Tools & Utilitas
- **.dl <link>** : Universal Video Downloader (Support YouTube, TikTok, IG, FB, dll) menggunakan **yt-dlp**.
- **.s / .sticker** : Convert Gambar/Video menjadi Sticker WA.
- **.sfile <query>** : Cari dan download file dari Sfile.mobi.
- **.berita <sumber>** : Baca berita terbaru (cnn/detik).

### ⚙️ System & Owner
- **.status** : Cek RAM, Baterai, OS, dan Provider Internet.
- **.neofetch** : Info spesifikasi device yang estetik.
- **.bc <pesan>** : Broadcast pesan ke semua grup/chat (Owner Only).

---

## 📦 Cara Install di Termux (Lengkap & Anti Error)

Ikuti langkah ini satu per satu agar semua fitur (Downloader, Sticker, Scraping) berjalan lancar.

### Update & Install Paket Utama
Kita membutuhkan Git, Node.js, FFmpeg (untuk sticker), Neofetch (untuk status), dan Python (untuk downloader).

```bash
pkg update && pkg upgrade -y
pkg install git nodejs ffmpeg libwebp neofetch python -y
pip install yt-dlp
npm install
node index.js
