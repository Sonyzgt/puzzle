require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const WINNERS_FILE = path.join(__dirname, 'winners.json');
let winners = [];
const activePlayers = new Map(); // Store active player states
const sseClients = new Set(); // CCTV: SSE Connections <!-- id: sse_setup -->
let gameEnabled = true; // Global game toggle <!-- id: game_status_setup -->

function loadWinners() {
    if (fs.existsSync(WINNERS_FILE)) {
        try {
            winners = JSON.parse(fs.readFileSync(WINNERS_FILE, 'utf8')) || [];
        } catch (err) {
            console.error('Gagal membaca winners.json, menggunakan array kosong', err);
            winners = [];
        }
    }
}

function saveWinners() {
    fs.writeFileSync(WINNERS_FILE, JSON.stringify(winners, null, 2));
}

loadWinners();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Simple route to serve the game
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// CCTV route
app.get('/cctv', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cctv.html'));
});

// API Login check
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Password salah!' });
    }
});

// API Get reward link
app.get('/api/reward', (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    res.json({ link: process.env.REWARD_LINK || '/' });
});

// API Update reward link
app.post('/api/reward', (req, res) => {
    const { link, password } = req.body;

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Password salah!' });
    }

    if (link) {
        process.env.REWARD_LINK = link;

        // Save to .env file
        const envPath = path.join(__dirname, '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        let envLines = envContent.split(/\r?\n/);

        let found = false;
        for (let i = 0; i < envLines.length; i++) {
            if (envLines[i].startsWith('REWARD_LINK=')) {
                envLines[i] = `REWARD_LINK=${link}`;
                found = true;
                break;
            }
        }
        if (!found) {
            envLines.push(`REWARD_LINK=${link}`);
        }

        fs.writeFileSync(envPath, envLines.join('\n'));
        res.json({ success: true, message: 'Link reward berhasil diperbarui!' });
    } else {
        res.status(400).json({ success: false, message: 'Link tidak boleh kosong.' });
    }
});

// API Get winners history
app.get('/api/winners', (req, res) => {
    res.json({ success: true, winners });
});

// API Add winner for real-time list
app.post('/api/winners', (req, res) => {
    const { name, moves, time } = req.body;
    const playerName = (name || 'Pemain Tanpa Nama').toString().trim() || 'Pemain Tanpa Nama';

    if (!moves) {
        return res.status(400).json({ success: false, message: 'Moves tidak boleh kosong.' });
    }

    const entry = {
        name: playerName,
        moves: Number(moves),
        seconds: Number(time) || 0,
        finishedAt: new Date().toISOString()
    };

    winners.unshift(entry);
    winners = winners.slice(0, 20); // hanya simpan 20 terbaru
    saveWinners();

    // Notifikasi via Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId && !botToken.startsWith('<')) {
        const message = encodeURIComponent(`🏆 *Pemenang Baru!*\nNama: ${playerName}\nLangkah: ${entry.moves}\nWaktu: ${entry.seconds}s\nWaktu selesai: ${new Date(entry.finishedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
        const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;

        https.get(tgUrl, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Gagal kirim Telegram (Status: ${res.statusCode})`);
            } else {
                console.log('Notifikasi Telegram berhasil dikirim.');
            }
        }).on('error', (e) => console.error('Gagal kirim notif Telegram pemenang:', e));
    } else {
        console.log('Notifikasi Telegram dilewati: Token atau Chat ID tidak valid.');
    }

    res.json({ success: true, message: 'Data pemenang terkirim.', winner: entry });
});

// CCTV: API Update player status
app.post('/api/status', (req, res) => {
    const { name, tiles, moves } = req.body;
    if (!name) return res.status(400).json({ success: false });

    activePlayers.set(name, {
        tiles,
        moves,
        lastUpdate: Date.now()
    });

    // CCTV: Push update to all SSE clients instantly <!-- id: sse_broadcast -->
    const updatePayload = JSON.stringify({ type: 'update', name, tiles, moves, lastUpdate: Date.now() });
    sseClients.forEach(client => {
        client.res.write(`data: ${updatePayload}\n\n`);
    });

    res.json({ success: true });
});

// CCTV: Auto-cleanup inactive players every 2 seconds <!-- id: sse_auto_cleanup -->
setInterval(() => {
    const now = Date.now();
    activePlayers.forEach((data, name) => {
        if (now - data.lastUpdate > 7000) { // 7 seconds threshold
            activePlayers.delete(name);
            const removePayload = JSON.stringify({ type: 'remove', name });
            sseClients.forEach(client => {
                client.res.write(`data: ${removePayload}\n\n`);
            });
        }
    });
}, 2000);

// CCTV: SSE Endpoint for real-time monitoring <!-- id: sse_endpoint -->
app.get('/api/admin/sse', (req, res) => {
    const password = req.query.password;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    sseClients.add(newClient);

    req.on('close', () => {
        sseClients.delete(newClient);
    });
});

// CCTV: API Get all active players for Admin
app.get('/api/admin/players', (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false });
    }

    const now = Date.now();
    const result = {};
    activePlayers.forEach((data, name) => {
        // Only show players active in the last 60 seconds
        if (now - data.lastUpdate < 60000) {
            result[name] = data;
        } else {
            activePlayers.delete(name);
        }
    });

    res.json({ success: true, players: result });
});

// API: Get current game configuration <!-- id: get_config -->
app.get('/api/config', (req, res) => {
    res.json({ gameEnabled });
});

// API: Update game configuration (Admin only) <!-- id: update_config -->
app.post('/api/config', (req, res) => {
    const { password, enabled } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    gameEnabled = enabled;
    res.json({ success: true, gameEnabled });
});

// Reward endpoint (optional, if you want server-side logic before redirecting)
app.get('/reward', (req, res) => {
    const rewardLink = process.env.REWARD_LINK || '/';
    res.redirect(rewardLink);
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
