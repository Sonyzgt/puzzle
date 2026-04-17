const https = require('https');

const token = '8519354300:AAG_2-Kp3-tTXhXUt06jVbh7O7ZTjvNB7Ks';
const chatId = '-1003543577811';
const message = encodeURIComponent('🚀 Test koneksi Telegram dari Localhost: BERHASIL! (Full Test)');
const tgUrl = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;

console.log('Testing send message to chatId:', chatId);

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
