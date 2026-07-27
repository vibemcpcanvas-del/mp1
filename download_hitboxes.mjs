import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

const regex = /mapImg:\s*"(\.\/images\/([^"]+))"/g;
let match;
const relativePaths = [];

while ((match = regex.exec(html)) !== null) {
  relativePaths.push(match[2]);
}

const uniquePaths = [...new Set(relativePaths)];
console.log(`Found ${uniquePaths.length} map images.`);

const baseHitboxDir = path.join(__dirname, 'Hitbox');
if (!fs.existsSync(baseHitboxDir)) {
  fs.mkdirSync(baseHitboxDir);
}

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else {
        // Many maps might not have a hitbox version on the original site
        // Just quietly fail for those or log it
        resolve(false);
      }
    }).on('error', (err) => {
      resolve(false);
    });
  });
};

const downloadAll = async () => {
  let successCount = 0;
  for (const relPath of uniquePaths) {
    // encodeURI replaces spaces with %20 which is necessary for URLs
    const urlPath = relPath.split('/').map(p => encodeURIComponent(p)).join('/');
    const url = `https://maplebuild.kr/Hitbox/${urlPath}`;
    const destPath = path.join(baseHitboxDir, relPath);
    
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (!fs.existsSync(destPath)) {
        const success = await downloadFile(url, destPath);
        if (success) {
           successCount++;
        }
    } else {
        successCount++;
    }
  }
  console.log(`Finished downloading ${successCount} hitbox images out of ${uniquePaths.length}.`);
};

downloadAll();
