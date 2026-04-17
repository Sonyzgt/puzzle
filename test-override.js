console.log('--- Before dotenv ---');
console.log(`Token: "${process.env.TELEGRAM_BOT_TOKEN}"`);

require('dotenv').config();

console.log('--- After dotenv ---');
console.log(`Token: "${process.env.TELEGRAM_BOT_TOKEN}"`);
