const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const qrcode = require('qrcode-terminal');
const jimp = require('jimp');

const SESSION_DIR = './auth_info';

// ==============================================================================
// 🛠️ KONFIGURASI UTAMA (SILAKAN EDIT DI SINI) 🛠️
// ==============================================================================
const CONFIG = {
    // Daftar Owner (Nomor HP & LID)
    ownerNumbers: ['628xxxxxxxxxx'], 
    ownerLids:    ['xxxxxxxxxxxxxxx@lid'], 

    // Info Saluran
    channelLink:  'https://whatsapp.com/channel/0029VagADOLLSmbvdMMZ5K3h',
    channelName:  'Bot Bawang Goreng'
};


// ==============================================================================
// 🔒 ZONA PERMANEN (LOGIKA INTI - JANGAN DIUBAH) 🔒
// ==============================================================================

const checkIsOwner = (sender) => {
    const senderNumber = sender.replace('@s.whatsapp.net', '').replace('@lid', '');
    const isNumberOwner = CONFIG.ownerNumbers.includes(senderNumber);
    const isLidOwner = CONFIG.ownerLids.includes(sender);
    return isNumberOwner || isLidOwner;
};

const logHandler = (m, command, args, sender) => {
    const pushName = m.pushName || 'Tanpa Nama';
    const senderNumber = sender.replace('@s.whatsapp.net', '').replace('@lid', '');
    const timeLog = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const isGroup = m.key.remoteJid.endsWith('@g.us');
    const chatType = isGroup ? '👥 Grup' : '👤 Pribadi';

    console.log('\n================ [ LOG USER ] ================');
    console.log(`🕒 Waktu   : ${timeLog}`);
    console.log(`💬 Tipe    : ${chatType}`);
    console.log(`👤 Nama    : ${pushName}`);
    console.log(`📱 Nomor   : ${senderNumber}`);
    console.log(`🔑 JID/LID : ${sender}`); 
    console.log(`💬 Command : ${command} ${args.join(' ')}`);
    console.log('==============================================\n');
    
    return { pushName, senderNumber };
};

const showMenu = (pushName, senderNumber, isOwner) => {
    const userStatus = isOwner ? '👑 Owner (Admin)' : '🍕 User (Pengguna)';
    const timeNow = new Date().toLocaleTimeString('id-ID', { hour12: false });
    
    return `
🌸 *I N F O   U S E R* 🌸
────────────────────
🍩 *Nama  : ${pushName}*
📱 *Nomor : ${senderNumber}*
🧁 *Status: ${userStatus}*
⏰ *Jam   : ${timeNow}*

🤖 *D A F T A R   F I T U R*
────────────────────
👇 *Media & Tools* 👇

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

────────────────────
Created with By Faris Suka Mie Ayam🔥
`;
};


// ==============================================================================
// 🚀 LOGIKA UTAMA KONEKSI
// ==============================================================================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Bot Termux", "Chrome", "1.0.0"],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Scan QR Code di bawah ini:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Menyambung ulang...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Bot berhasil terhubung! Siap menerima pesan.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        if (m.key.fromMe) return;

        const messageType = getContentType(m.message);
        const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
        
        if (!text.startsWith('.')) return;

        // --- CORE LOGIC ---
        const command = text.split(' ')[0].toLowerCase();
        const args = text.split(' ').slice(1);
        
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const sender = isGroup ? m.key.participant : m.key.remoteJid;
        const senderNumber = sender.replace('@s.whatsapp.net', '').replace('@lid', '');
        
        const isOwner = checkIsOwner(sender);
        const { pushName } = logHandler(m, command, args, sender);

        try {
            // ==================================================================
            // 🎮 AREA FITUR
            // ==================================================================

            // [FITUR] MENU
            if (command === '.menu' || command === '.help') {
                const menuText = showMenu(pushName, senderNumber, isOwner);
                
                let ppUrl;
                try {
                    ppUrl = await sock.profilePictureUrl(sock.user.id.split(':')[0] + '@s.whatsapp.net', 'image');
                } catch {
                    ppUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png';
                }

                let buffer;
                try {
                    const response = await fetch(ppUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                } catch (e) {
                    buffer = Buffer.alloc(0);
                }

                await sock.sendMessage(m.key.remoteJid, { 
                    text: menuText,
                    contextInfo: {
                        externalAdReply: {
                            title: CONFIG.channelName,
                            body: 'Klik Gabung Disini',
                            thumbnail: buffer,
                            sourceUrl: CONFIG.channelLink,
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                }, { quoted: m });
            }

            // [FITUR] PING
            else if (command === '.ping') {
                const timestamp = m.messageTimestamp * 1000;
                const now = Date.now();
                const speed = now - timestamp;
                await sock.sendMessage(m.key.remoteJid, { text: `🏓 Pong! \n⚡ Speed: ${speed}ms` }, { quoted: m });
            }

            // [FITUR] NEOFETCH
            else if (command === '.neofetch' || command === '.neo') {
                await sock.sendMessage(m.key.remoteJid, { text: 'Sedang mengambil info system...' }, { quoted: m });
                exec('neofetch --stdout', (error, stdout, stderr) => {
                    if (error) {
                        sock.sendMessage(m.key.remoteJid, { text: 'Gagal. Pastikan pkg install neofetch' }, { quoted: m });
                        return;
                    }
                    sock.sendMessage(m.key.remoteJid, { text: stdout }, { quoted: m });
                });
            }

            // [FITUR] STICKER
            else if (command === '.sticker' || command === '.s') {
                const isImage = messageType === 'imageMessage';
                const isVideo = messageType === 'videoMessage';
                const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
                const isQuotedVideo = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

                if (!isImage && !isVideo && !isQuotedImage && !isQuotedVideo) {
                    return await sock.sendMessage(m.key.remoteJid, { text: 'Kirim/Reply gambar atau video dengan caption .sticker' }, { quoted: m });
                }

                let buffer;
                if (isImage || isVideo) {
                    buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                } else if (isQuotedImage || isQuotedVideo) {
                    const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const fakeMsg = { key: { id: 'fake_id' }, message: quotedMsg }; 
                    buffer = await downloadMediaMessage(fakeMsg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                }

                const inputPath = `./temp_${Date.now()}.${(isVideo || isQuotedVideo) ? 'mp4' : 'jpg'}`;
                const outputPath = `./sticker_${Date.now()}.webp`;
                fs.writeFileSync(inputPath, buffer);

                ffmpeg(inputPath)
                    .inputOptions(['-y'])
                    .complexFilter([
                        `scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1`
                    ])
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-loop', '0',
                        '-preset', 'default',
                        '-an',
                        '-vsync', '0',
                        '-s', '512x512'
                    ])
                    .save(outputPath)
                    .on('end', async () => {
                        await sock.sendMessage(m.key.remoteJid, { sticker: fs.readFileSync(outputPath) }, { quoted: m });
                        if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                        if(fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        console.log(`[INFO] Sticker berhasil dikirim ke ${pushName}`);
                    })
                    .on('error', (err) => {
                        console.error('[ERROR] Sticker:', err);
                        sock.sendMessage(m.key.remoteJid, { text: 'Gagal membuat sticker.' }, { quoted: m });
                        if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    });
            }

            // [FITUR BARU] AUDIO / MP3
            else if (command === '.audio' || command === '.mp3') {
                const url = args[0];
                if (!url) return await sock.sendMessage(m.key.remoteJid, { text: 'Masukkan link YouTube. Contoh: .mp3 https://youtu.be/...' }, { quoted: m });

                await sock.sendMessage(m.key.remoteJid, { text: '🎵 Sedang mengubah video ke audio...' }, { quoted: m });

                const outputFilename = `audio_${Date.now()}.mp3`;
                // Flag -x = Extract Audio, --audio-format mp3 = Konversi ke MP3
                const execCommand = `yt-dlp "${url}" -x --audio-format mp3 -o "${outputFilename}"`;

                exec(execCommand, async (error, stdout, stderr) => {
                    if (error) {
                        return await sock.sendMessage(m.key.remoteJid, { text: 'Gagal konversi audio.' }, { quoted: m });
                    }

                    if (fs.existsSync(outputFilename)) {
                        try {
                            await sock.sendMessage(m.key.remoteJid, { 
                                audio: fs.readFileSync(outputFilename), 
                                mimetype: 'audio/mp4', // Trik agar terbaca sebagai audio di WA
                                ptt: false // false = Audio biasa, true = Voice Note
                            }, { quoted: m });
                            console.log(`[INFO] Audio dikirim ke ${pushName}`);
                        } catch (err) {
                            await sock.sendMessage(m.key.remoteJid, { text: 'Gagal mengirim file audio.' }, { quoted: m });
                        } finally {
                            if(fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);
                        }
                    }
                });
            }

            // [FITUR FIX] DOWNLOAD VIDEO (PLAYABLE DI WA)
            else if (command === '.download' || command === '.dl') {
                const url = args[0];
                if (!url) return await sock.sendMessage(m.key.remoteJid, { text: 'Masukkan link videonya. Contoh: .dl https://youtube.com/...' }, { quoted: m });

                await sock.sendMessage(m.key.remoteJid, { text: '🎥 Sedang mendownload video...' }, { quoted: m });

                const outputFilename = `download_${Date.now()}.mp4`;
                
                // --- PERBAIKAN UTAMA ---
                // Menggunakan format "best[ext=mp4]" memastikan codec H.264 yang disupport WA
                // Jika tidak ada, fallback ke bestvideo+bestaudio lalu merge jadi mp4
                const execCommand = `yt-dlp "${url}" -f "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]" --merge-output-format mp4 -o "${outputFilename}"`;

                exec(execCommand, async (error, stdout, stderr) => {
                    if (error) {
                        return await sock.sendMessage(m.key.remoteJid, { text: 'Gagal mendownload.' }, { quoted: m });
                    }

                    if (fs.existsSync(outputFilename)) {
                        try {
                            const stats = fs.statSync(outputFilename);
                            const fileSizeInMB = stats.size / (1024 * 1024);

                            if (fileSizeInMB > 90) { 
                                await sock.sendMessage(m.key.remoteJid, { text: `File terlalu besar (${fileSizeInMB.toFixed(2)} MB).` }, { quoted: m });
                            } else {
                                await sock.sendMessage(m.key.remoteJid, { 
                                    video: fs.readFileSync(outputFilename), 
                                    caption: '✅ Berhasil didownload & Playable!' 
                                }, { quoted: m });
                                console.log(`[INFO] Video dikirim ke ${pushName}`);
                            }
                        } catch (err) {
                            await sock.sendMessage(m.key.remoteJid, { text: 'Gagal mengirim file.' }, { quoted: m });
                        } finally {
                            if(fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);
                        }
                    }
                });
            }

            // [FITUR] SET PHOTO PROFILE (KHUSUS OWNER)
            else if (command === '.setpp') {
                if (!isOwner) {
                     return await sock.sendMessage(m.key.remoteJid, { text: '⚠️ Fitur ini khusus Owner!' }, { quoted: m });
                }

                const isImage = messageType === 'imageMessage';
                const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

                if (!isImage && !isQuotedImage) {
                    return await sock.sendMessage(m.key.remoteJid, { text: 'Kirim/Reply gambar dengan caption .setpp' }, { quoted: m });
                }

                await sock.sendMessage(m.key.remoteJid, { text: 'Sedang mengganti foto profil...' }, { quoted: m });
                try {
                    let buffer;
                    if (isImage) {
                         buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    } else {
                         const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                         const fakeMsg = { key: { id: 'fake_id' }, message: quotedMsg }; 
                         buffer = await downloadMediaMessage(fakeMsg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    }
                    
                    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    await sock.updateProfilePicture(botNumber, buffer);
                    await sock.sendMessage(m.key.remoteJid, { text: 'Sukses ganti PP!' }, { quoted: m });
                } catch (e) {
                    console.error('[ERROR] Set PP:', e);
                    await sock.sendMessage(m.key.remoteJid, { text: 'Gagal. Pastikan library jimp terinstall.' }, { quoted: m });
                }
            }

        } catch (e) {
            console.error('[CRITICAL ERROR]', e);
        }
    });
}

connectToWhatsApp();
                                
