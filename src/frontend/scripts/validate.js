import fetch from 'node-fetch';
import fs from 'fs';
const log = (msg) => fs.appendFileSync('logs/validation.log', msg + '\n');
async function check(url) {
  try {
    const r = await fetch(url);
    log(`${url} → ${r.status}`);
  } catch (e) {
    log(`${url} → error: ${e.message}`);
  }
}
await check('http://localhost:8000/health');
await check('http://localhost:3000');
await check(`${process.env.SUPABASE_URL}/rest/v1/`);
console.log('Validation complete');
