const https = require('https');

const token = '8519354300:AAG_2-Kp3-tTXhXUt06jVbh7O7ZTjvNB7Ks';
const tgUrl = `https://api.telegram.org/bot${token}/getMe`;

console.log('Testing hardcoded token:', token);

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
