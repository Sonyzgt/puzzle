require('dotenv').config({ override: true });
const https = require('https');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken) {
    console.error('Bot Token not found in process.env');
    process.exit(1);
}

console.log(`Token: "${botToken}"`);
console.log(`Length: ${botToken.length}`);
console.log('Characters (Hex):', Array.from(botToken).map(c => c.charCodeAt(0).toString(16)).join(' '));

const message = encodeURIComponent('🤖 Test hidden characters');
const tgUrl = `https://api.telegram.org/bot${botToken}/getMe`;

https.get(tgUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', data);
    });
}).on('error', (e) => {
    console.error('Error:', e.message);
});
