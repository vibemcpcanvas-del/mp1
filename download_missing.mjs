import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = fs.readFileSync(path.join(__dirname, 'apps/web/index.html'), 'utf-8');

const regex = /['"](\.\/(Skillicon|mob|icon|charactericon|bgm)\/[^'"]+)['"]/g;
let match;
const relativePaths = [];

while ((match = regex.exec(html)) !== null) {
  relativePaths.push(match[1]);
}

const uniquePaths = [...new Set(relativePaths)];
console.log(`Found ${uniquePaths.length} assets.`);

const downloadFile = (url, dest) => {
  return new Promise((resolve) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else {
        resolve(false);
      }
    }).on('error', () => {
      resolve(false);
    });
  });
};

const downloadAll = async () => {
  let successCount = 0;
  for (const relPath of uniquePaths) {
    const cleanPath = relPath.replace('./', '');
    const urlPath = cleanPath.split('/').map(p => encodeURIComponent(p)).join('/');
    const url = `https://maplebuild.kr/${urlPath}`;
    const destPath = path.join(__dirname, 'apps/web', cleanPath);
    
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
        const success = await downloadFile(url, destPath);
        if (success) {
           successCount++;
           console.log(`Downloaded ${cleanPath}`);
        }
    } else {
        // Already exists
    }
  }
  console.log(`Finished downloading ${successCount} new assets.`);
};

downloadAll();
