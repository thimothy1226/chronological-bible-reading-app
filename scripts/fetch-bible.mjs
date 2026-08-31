import fs from 'fs';
import path from 'path';
import https from 'https';

const url = 'https://raw.githubusercontent.com/bluesaurel/Korean-Bible-1961-KRV/main/bible_1961_krv.json';
const out = path.join(process.cwd(), 'assets', 'bibles', 'krv.json');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'chronological-bible-reading-app' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location));
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

const data = await get(url);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, data);
console.log(`KRV Bible data saved: ${out} (${data.length} bytes)`);
