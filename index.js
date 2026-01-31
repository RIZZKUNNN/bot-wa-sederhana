/*
    🤖 BOT WHATSAPP TERMUX - CLEAN EDITION (V17)
    
*/

// --- 1. CONFIG OWNER ---
const superAdmins = ['Ganti Dengan Id Lindev WhatsApp Mu Sendiri']; 
// -----------------------

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    downloadMediaMessage,
    delay,
    jidNormalizedUser,
    generateWAMessageFromContent,
    generateWAMessageContent,
    proto
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { exec } = require('child_process');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const jimp = require('jimp'); 
const crypto = require('crypto');
const cheerio = require('cheerio'); 
const os = require('os');

// --- DATABASE & UTILS ---
const chatDbPath = './database_chats.json';
const ownerDbPath = './database_owners.json';
let allChats = [];
let owners = [...superAdmins];

try { allChats = JSON.parse(fs.readFileSync(chatDbPath)); } catch { allChats = []; }
try { 
    const saved = JSON.parse(fs.readFileSync(ownerDbPath));
    owners = [...new Set([...superAdmins, ...saved])];
} catch { fs.writeFileSync(ownerDbPath, JSON.stringify(owners)); }

const saveChat = (jid) => {
    if (jid.includes('status') || jid.includes('broadcast')) return;
    if (!allChats.includes(jid)) {
        allChats.push(jid);
        fs.writeFileSync(chatDbPath, JSON.stringify(allChats));
    }
}
const saveOwners = () => fs.writeFileSync(ownerDbPath, JSON.stringify(owners, null, 2));

const userSessions = {}; 
const sanitizeId = (id) => id?.split(':')[0].split('@')[0].replace(/\D/g, '') || '';
const runtime = (seconds) => {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    return `${d > 0 ? d + "h, " : ""}${h > 0 ? h + "j, " : ""}${m > 0 ? m + "m, " : ""}${s}d`;
}
const extractUrl = (text) => {
    const match = text.match(/(https?:\/\/[^\s]+)/);
    return match ? match[0] : null;
}

// --- FUNGSI ANIMEXIN (FIXED) ---
async function animexinScraper(query) {
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0' };

        // 1. Latest
        if (!query) {
            const response = await fetch('https://animexin.dev/', { headers });
            const $ = cheerio.load(await response.text());
            const results = [];
            $('.hpage .listupd .bs').each((i, el) => {
                if (i < 5) results.push({
                    title: $(el).find('.tt').text().trim(),
                    link: $(el).find('a').attr('href'),
                    img: $(el).find('img').attr('src'),
                    info: $(el).find('.epx').text().trim(),
                    type: 'Latest'
                });
            });
            return results;
        }

        // 2. Search Logic
        const args = query.split(' ');
        const lastArg = args[args.length - 1];
        let isEpisodeSearch = !isNaN(lastArg); 
        let titleQuery = isEpisodeSearch ? args.slice(0, -1).join(' ') : query;
        let targetEpisode = isEpisodeSearch ? lastArg : null;

        const response = await fetch(`https://animexin.dev/?s=${encodeURIComponent(titleQuery)}`, { headers });
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];

        $('.listupd .bs').each((i, el) => {
            if (i < 5) results.push({
                title: $(el).find('.tt').text().trim(),
                link: $(el).find('a').attr('href'),
                img: $(el).find('img').attr('src'),
                info: $(el).find('.typez').text().trim(),
                type: 'Search'
            });
        });

        // 3. Episode Logic + Fallback
        if (isEpisodeSearch && results.length > 0) {
            const bestMatch = results[0];
            const detailRes = await fetch(bestMatch.link, { headers });
            const detailHtml = await detailRes.text();
            const $$ = cheerio.load(detailHtml);
            
            let foundLink = null;
            $$('.eplister ul li').each((i, el) => {
                const epNumText = $$(el).find('.epl-num').text().trim(); 
                if (epNumText == targetEpisode || epNumText.includes(targetEpisode)) {
                    foundLink = $$(el).find('a').attr('href');
                    return false; 
                }
            });

            if (foundLink) {
                const epRes = await fetch(foundLink, { headers });
                const $$$ = cheerio.load(await epRes.text());
                let downloadLinks = "";
                $$$('.soraddl .dlx').each((i, el) => {
                    const res = $$$(el).find('h4').text();
                    downloadLinks += `\n📥 *${res}*: `;
                    $$$(el).find('a').each((j, lnk) => {
                        downloadLinks += `[${$$$(lnk).text()}](${$$$(lnk).attr('href')}) `;
                    });
                });

                return [{ 
                    title: `Episode ${targetEpisode} - ${bestMatch.title}`, 
                    link: foundLink, 
                    img: bestMatch.img, 
                    downloads: downloadLinks,
                    type: 'EpisodeMatch' 
                }];
            } else {
                return [{
                    title: `${bestMatch.title} (Eps ${targetEpisode} Not Found)`,
                    link: bestMatch.link,
                    img: bestMatch.img,
                    info: '⚠️ Buka link ini untuk cek manual',
                    type: 'Search'
                }];
            }
        }
        return results;
    } catch (e) { return []; }
}

// --- FUNGSI DOWNLOADER ---
function processDownload(sock, from, q, f, u, fd) {
    const filename = `vid_${Date.now()}.mp4`;
    exec(`yt-dlp ${f} -o "${filename}" "${u}"`, async (error) => {
        if (error) { if (fs.existsSync(filename)) fs.unlinkSync(filename); return sock.sendMessage(from, {text:'❌ Gagal Download.'}, {quoted:q}); }
        if (fs.existsSync(filename)) {
            try {
                const stats = fs.statSync(filename);
                if ((stats.size / (1024 * 1024)) > 100 || fd) {
                    await sock.sendMessage(from, { document: fs.readFileSync(filename), mimetype: 'video/mp4', fileName: 'video.mp4' }, { quoted: q });
                } else {
                    await sock.sendMessage(from, { video: fs.readFileSync(filename), caption: '✅ Done' }, { quoted: q });
                }
            } catch (e) { await sock.sendMessage(from, {text:'❌ Gagal kirim.'}, {quoted:q}); } 
            finally { if (fs.existsSync(filename)) fs.unlinkSync(filename); }
        }
    });
}

// --- FUNGSI SCRAPER LAINNYA ---
async function sfileSearch(query) {
    try {
        const response = await fetch(`https://sfile.co/search.php?q=${query}&search=Search`);
        const $ = cheerio.load(await response.text());
        const results = [];
        $('.list').each((i, el) => {
            const link = $(el).find('a').attr('href');
            const name = $(el).find('a').text();
            const info = $(el).text().replace(name, '').trim(); 
            if (link && name && link !== 'https://sfile.co/') results.push({ name, link, info });
        });
        return results;
    } catch (e) { return []; }
}

async function sfileDownload(url) {
    try {
        const response = await fetch(url);
        const $ = cheerio.load(await response.text());
        const filename = $('.intro').text().trim() || 'file.rar';
        let downloadLink = $('#download').attr('href');
        if (!downloadLink) return null;
        const fileRes = await fetch(downloadLink);
        return { buffer: Buffer.from(await fileRes.arrayBuffer()), filename, mimetype: fileRes.headers.get('content-type') };
    } catch (e) { return null; }
}

async function searchOtakudesu(query) {
    try {
        const url = query ? `https://otakudesu.best/?s=${encodeURIComponent(query)}&post_type=anime` : `https://otakudesu.best/ongoing-anime/`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(await response.text());
        const results = [];
        const selector = query ? 'ul.chivsrc li' : '.venz ul li';
        $(selector).each((i, el) => {
            if(i<5) {
                const title = query ? $(el).find('h2 a').text() : $(el).find('.jdlfl').text();
                const link = query ? $(el).find('h2 a').attr('href') : $(el).find('.jdlfl').closest('a').attr('href');
                const img = query ? $(el).find('img').attr('src') : $(el).find('.thumbz img').attr('src');
                const info = query ? $(el).find('.set').first().text() : $(el).find('.epz').text();
                if(title && link) results.push({ title, link, img, info });
            }
        });
        return results;
    } catch (e) { return []; }
}

async function searchKusonime(query) {
    try {
        const url = query ? `https://kusonime.com/?s=${encodeURIComponent(query)}&post_type=post` : `https://kusonime.com/`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(await response.text());
        const results = [];
        $('.kover').each((i, el) => {
            if(i<5) results.push({ title: $(el).find('.content h2 a').text(), link: $(el).find('.content h2 a').attr('href'), img: $(el).find('.thumbz img').attr('src'), info: $(el).find('.content p').text().trim().replace(/\s+/g, ' ') });
        });
        return results;
    } catch (e) { return []; }
}

async function fetchNews(source) {
    try {
        let articles = [];
        const headers = { 'User-Agent': 'Mozilla/5.0' };
        if (source === 'detik') {
            const response = await fetch('https://www.detik.com/terpopuler', { headers });
            const $ = cheerio.load(await response.text());
            $('article.list-content__item').each((i, el) => {
                if (i < 5) articles.push({ title: $(el).find('.media__title a').text().trim(), link: $(el).find('.media__title a').attr('href') });
            });
        } else if (source === 'cnn') {
            const response = await fetch('https://berita-indo-api.vercel.app/v1/cnn-news/');
            const json = await response.json();
            if (json.data) articles = json.data.slice(0, 5);
        }
        return articles;
    } catch (e) { return null; }
}

const updateProfilePicture = async (sock, jid, buffer) => {
    const jimpImg = await jimp.read(buffer);
    const min = Math.min(jimpImg.getWidth(), jimpImg.getHeight());
    const cropped = jimpImg.crop(0, 0, min, min).scaleToFit(720, 720);
    const img = await cropped.getBufferAsync(jimp.MIME_JPEG);
    await sock.query({ tag: 'iq', attrs: { to: jidNormalizedUser(jid), type: 'set', xmlns: 'w:profile:picture' }, content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }] });
}

async function groupStatus(conn, jid, content) {
    const { backgroundColor } = content;
    if (content.backgroundColor) delete content.backgroundColor;
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);
    const m = generateWAMessageFromContent(jid, { messageContextInfo: { messageSecret }, groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } } }, { userJid: conn.user.id });
    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Bot Final Clean V17', 'Chrome', '12.0'],
        connectTimeoutMs: 60000,
        emitOwnEvents: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT ONLINE! Features: Animexin, Sfile, Otaku, Kuso, DL.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;
        
        const key = m.key;
        const from = key.remoteJid;
        saveChat(from);

        const messageType = Object.keys(m.message)[0];
        const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
        
        const rawSender = m.key.fromMe ? sock.user.id : (m.key.participant || from);
        const senderNumber = sanitizeId(rawSender);
        const isOwner = owners.includes(senderNumber) || m.key.fromMe;
        const botNumber = jidNormalizedUser(sock.user.id);

        if (text === '.ping') {
            const latensi = Date.now() - (m.messageTimestamp * 1000);
            await sock.sendMessage(from, { text: `🏓 Pong! *${latensi} ms*\n⏳ Uptime: ${runtime(process.uptime())}` }, { quoted: m });
            return;
        }

        if (messageType === 'documentMessage' && m.message.documentMessage.fileName === 'cookies.txt') {
            const buffer = await downloadMediaMessage(m, 'buffer', { logger: pino({ level: 'silent' }) });
            fs.writeFileSync('cookies.txt', buffer);
            await sock.sendMessage(from, { text: '✅ Cookies tersimpan!' }, { quoted: m });
            return;
        }

        // --- ANIMEXIN ---
        if (text.startsWith('.animexin')) {
            const query = text.replace('.animexin', '').trim();
            const statusMsg = query ? `Mencari "${query}"` : "Update Terbaru";
            await sock.sendMessage(from, { text: `⏳ ${statusMsg} di Animexin...` }, { quoted: m });
            const results = await animexinScraper(query);
            if (results.length > 0) {
                let msg = "";
                if (results[0].type === 'EpisodeMatch') {
                    const res = results[0];
                    msg = `🎬 *${res.title}*\n🔗 *Page:* ${res.link}\n\n${res.downloads ? res.downloads : '⚠️ Link download manual.'}`;
                } else {
                    msg = `🎥 *ANIMEXIN*\n\n`;
                    results.forEach((a) => msg += `*${a.title}*\n📝 ${a.info}\n🔗 ${a.link}\n\n`);
                }
                const firstThumb = results[0].img;
                if (firstThumb) await sock.sendMessage(from, { image: { url: firstThumb }, caption: msg }, { quoted: m });
                else await sock.sendMessage(from, { text: msg }, { quoted: m });
            } else await sock.sendMessage(from, { text: '❌ Tidak ditemukan.\nJika cari episode: .animexin judul angka' }, { quoted: m });
            return;
        }

        // --- MENU ---
        if (text === '.menu' || text === '.help') {
            const menuText = `🤖 *MENU BOT*

📰 *.berita detik* (Web)
📰 *.berita cnn* (API)
📥 *.dl <link>*
🎨 *.s* (Sticker)
🎥 *.otakudesu <txt>* (On-Going/Cari)
🎥 *.kusonime <txt>* (Batch/Cari)
📁 *.sfile <txt>* (Cari/Download)
🎥 *.animexin <txt>* (Donghua)

👑 *OWNER:*
.bc (Broadcasting)
.neofetch
.status`;
            await sock.sendMessage(from, { text: menuText }, { quoted: m });
            return;
        }

        // --- STATUS ---
        if (text === '.status') {
            if (!isOwner) return sock.sendMessage(from, { text: '❌ Owner Only.' }, { quoted: m });
            await sock.sendMessage(from, { text: '⏳ Checking...' }, { quoted: m });
            
            const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
            const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);
            const platform = `${os.type()} ${os.release()}`;
            const uptime = runtime(process.uptime());
            
            let isp = "Unknown";
            try {
                const res = await fetch('http://ip-api.com/json/');
                const json = await res.json();
                isp = json.isp || "Unknown";
            } catch (e) {}

            exec('termux-battery-status', (err, stdout) => {
                let battery = 'N/A';
                if (!err && stdout) try { battery = JSON.parse(stdout).percentage + '%' } catch {}
                
                const statusText = `
📊 *SYSTEM STATUS*

📡 *Provider:* ${isp}
💻 *RAM:* ${totalMem - freeMem}MB / ${totalMem}MB
📱 *OS:* ${platform}
🔋 *Baterai:* ${battery}
⏳ *Uptime:* ${uptime}
`;
                sock.sendMessage(from, { text: statusText }, { quoted: m });
            });
            return;
        }

        // --- FITUR LAIN (SFILE, OTAKU, DLL) ---
        if (text.startsWith('.sfile')) {
            const args = text.replace(/^\.sfile\s*/i, '').trim();
            if (!args) return sock.sendMessage(from, { text: '🔍 .sfile link/txt' }, { quoted: m });
            if (args.startsWith('http')) {
                await sock.sendMessage(from, { text: '⏳ Download...' }, { quoted: m });
                const fileData = await sfileDownload(args);
                if (fileData) {
                    if (fileData.buffer.length > 100 * 1024 * 1024) return sock.sendMessage(from, { text: '❌ File > 100MB.' }, { quoted: m });
                    await sock.sendMessage(from, { document: fileData.buffer, mimetype: fileData.mimetype, fileName: fileData.filename }, { quoted: m });
                } else await sock.sendMessage(from, { text: '❌ Gagal.' }, { quoted: m });
                return;
            }
            await sock.sendMessage(from, { text: `🔍 Mencari "${args}"...` }, { quoted: m });
            const results = await sfileSearch(args);
            if (results.length > 0) {
                let msg = `📂 *HASIL SFILE*\n\n`;
                results.forEach((f, i) => { if(i<10) msg += `*${i+1}. ${f.name}*\n📦 ${f.info}\n🔗 ${f.link}\n\n`; });
                await sock.sendMessage(from, { text: msg }, { quoted: m });
            } else await sock.sendMessage(from, { text: '❌ Tidak ditemukan.' }, { quoted: m });
            return;
        }

        if (text.startsWith('.otakudesu')) {
            const q = text.replace('.otakudesu','').trim();
            const res = await searchOtakudesu(q);
            if(res.length){
                let msg = `🎥 *OTAKUDESU*\n\n`;
                res.forEach(a => msg+=`*${a.title}*\n🔗 ${a.link}\n\n`);
                if(res[0].img) await sock.sendMessage(from, { image: { url: res[0].img }, caption: msg }, { quoted: m });
                else await sock.sendMessage(from, { text: msg }, { quoted: m });
            } else await sock.sendMessage(from, { text: '❌ 404' }, { quoted: m });
            return;
        }

        if (text.startsWith('.kusonime')) {
            const q = text.replace('.kusonime','').trim();
            const res = await searchKusonime(q);
            if(res.length){
                let msg = `🎥 *KUSONIME*\n\n`;
                res.forEach(a => msg+=`*${a.title}*\n🔗 ${a.link}\n\n`);
                if(res[0].img) await sock.sendMessage(from, { image: { url: res[0].img }, caption: msg }, { quoted: m });
                else await sock.sendMessage(from, { text: msg }, { quoted: m });
            } else await sock.sendMessage(from, { text: '❌ 404' }, { quoted: m });
            return;
        }

        if (text.startsWith('.berita')) {
            const src = text.split(' ')[1]?.toLowerCase();
            if(!['cnn','detik'].includes(src)) return sock.sendMessage(from, {text:'Pilih: .berita cnn/detik'}, {quoted:m});
            const res = await fetchNews(src);
            if(res && res.length) {
                let msg = `📢 *BERITA ${src.toUpperCase()}*\n\n`;
                res.forEach(a => msg+=`*${a.title}*\n🔗 ${a.link}\n\n`);
                await sock.sendMessage(from, { text: msg }, { quoted: m });
            } else await sock.sendMessage(from, { text: '❌ Gagal' }, { quoted: m });
            return;
        }

        if (text === '.neofetch' && isOwner) {
            exec('neofetch --stdout', (e,o) => sock.sendMessage(from, { text: o || '❌ Install neofetch' }, { quoted: m }));
            return;
        }

        if (isOwner) {
            if (text.startsWith('.bc')) {
                const txt = text.replace('.bc','').trim();
                if(!txt) return;
                await sock.sendMessage(from, {text:'⏳ Broadcast...'}, {quoted:m});
                for(let id of allChats) {
                    if(!id.includes('status')) { await delay(1000); await sock.sendMessage(id, {text:`[ BC ]\n${txt}`}).catch(()=>{}); }
                }
                await sock.sendMessage(from, {text:'✅ Done'}, {quoted:m});
            }
            if (text === '.setpp' && (m.message.imageMessage || m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage)) {
                await sock.sendMessage(from, {text:'⏳ Updating...'}, {quoted:m});
                const buff = await downloadMediaMessage(m.message.imageMessage ? m : {message:m.message.extendedTextMessage.contextInfo.quotedMessage}, 'buffer');
                await updateProfilePicture(sock, botNumber, buff);
                await sock.sendMessage(from, {text:'✅ Done'}, {quoted:m});
            }
            if (text.startsWith('.addowner')) {
                let t = text.split(' ')[1] || m.message.extendedTextMessage?.contextInfo?.participant?.split('@')[0];
                if(t) { owners.push(t.replace(/\D/g,'')); saveOwners(); sock.sendMessage(from,{text:'✅ Added'},{quoted:m}); }
            }
        }
        
        if (text === '.sticker' || text === '.s') {
            const isImg = messageType === 'imageMessage' || m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            if (isImg) {
                const buff = await downloadMediaMessage(isImg ? (messageType==='imageMessage'?m:{message:m.message.extendedTextMessage.contextInfo.quotedMessage}) : m, 'buffer');
                const inp = `temp_${Date.now()}.jpg`; const out = `s_${Date.now()}.webp`;
                fs.writeFileSync(inp, buff);
                exec(`ffmpeg -i ${inp} -vcodec libwebp -vf "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" -loop 0 -ss 00:00 -t 10 -preset default -an -vsync 0 -s 512x512 "${out}"`, (e)=>{
                    if(fs.existsSync(out)) sock.sendMessage(from, {sticker:fs.readFileSync(out)}, {quoted:m}).then(()=>{ fs.unlinkSync(inp); fs.unlinkSync(out); });
                });
            }
        }

        if (text.startsWith('.dl')) {
            const url = extractUrl(text);
            if (!url) return sock.sendMessage(from, { text: '⚠️ Link kosong.' }, { quoted: m });
            await sock.sendMessage(from, { text: '🚀 Downloading...' }, { quoted: m });
            const cookieFlag = fs.existsSync('cookies.txt') ? '--cookies cookies.txt' : '';
            const flags = `-f "best[ext=mp4]/best" --force-overwrites ${cookieFlag}`;
            processDownload(sock, from, m, flags, url, false);
        }
    });
}

function processDownload(sock, from, q, f, u, fd) {
    const o = `vid_${Date.now()}.mp4`;
    exec(`yt-dlp ${f} -o "${o}" "${u}"`, (e)=>{
        if(e) { if(fs.existsSync(o)) fs.unlinkSync(o); return sock.sendMessage(from, {text:'❌ Gagal.'}, {quoted:q}); }
        if(fs.existsSync(o)) {
            const s = fs.statSync(o).size / (1024*1024);
            if(s>100||fd) sock.sendMessage(from, {document:fs.readFileSync(o), mimetype:'video/mp4', fileName:'video.mp4'}, {quoted:q}).then(()=>fs.unlinkSync(o));
            else sock.sendMessage(from, {video:fs.readFileSync(o), caption:'✅ Done'}, {quoted:q}).then(()=>fs.unlinkSync(o));
        }
    });
}

connectToWhatsApp();
