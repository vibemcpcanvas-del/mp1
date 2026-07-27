import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const urls = [
  "dualblade.webp", "mechanic.webp", "fp.webp", "blaster.webp", "mihile.webp", "soulmaster.webp",
  "windbreaker.webp", "demonslayer.webp", "wildhunter.webp", "hoyoung.webp", "darkknight.webp",
  "illium.webp", "adele.webp", "pathfinder.webp", "striker.webp", "shadower.webp", "cannonshooter.webp",
  "lethe1.webp", "demonAvenger.webp", "hero.webp", "captain.webp", "viper.webp", "ren.webp",
  "lara.webp", "kinesis.webp", "evan.webp", "khali.webp", "ark.webp", "bowmaster.webp", "il.webp",
  "eunwol.webp", "xenon.webp", "aran.webp", "paladin.webp", "kaiser.webp", "luminous.webp",
  "zero.webp", "nightwalker.webp", "kain.webp", "phantom.webp", "bishop.webp", "mercedes.webp",
  "flamewizard.webp", "battlemage.webp", "marksman.webp", "angelic.webp", "cadena.webp", "nightlord.webp"
];

const dir = path.join(__dirname, 'charactericon');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

const downloadPromises = urls.map(name => {
  return new Promise((resolve, reject) => {
    const url = `https://maplebuild.kr/charactericon/${name}`;
    const filePath = path.join(dir, name);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filePath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded ${name}`);
          resolve();
        });
      } else {
        console.log(`Failed to download ${name} - Status: ${response.statusCode}`);
        resolve(); // resolve anyway to not break Promise.all
      }
    }).on('error', (err) => {
      console.log(`Error downloading ${name}: ${err.message}`);
      resolve();
    });
  });
});

Promise.all(downloadPromises).then(() => {
  console.log('All downloads finished.');
});
