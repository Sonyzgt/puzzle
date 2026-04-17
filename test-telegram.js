require('dotenv').config({ override: true });
const https = require('https');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('Testing Telegram Bot Token:', botToken);
console.log('Testing Telegram Chat ID:', chatId);

if (!botToken || !chatId || botToken.startsWith('<')) {
    console.error('Error: Token atau Chat ID tidak valid di .env (masih ada tanda < atau kosong)');
    process.exit(1);
}

const message = encodeURIComponent('🤖 Test koneksi Telegram dari Localhost: Berhasil!');
const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;

console.log('Sending test message...');
https.get(tgUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Test Berhasil! Pesan terkirim ke Telegram.');
            console.log('Response:', data);
        } else {
            console.error(`❌ Test Gagal! Status Code: ${res.statusCode}`);
            console.error('Response:', data);
        }
    });
}).on('error', (e) => {
    console.error('❌ Terjadi kesalahan saat menghubungi Telegram API:', e.message);
});
