/**
 * extract-data.mjs
 * 기존 index.html에서 RegionData와 JobDatabase를 파싱해
 * apps/web/src/data/regions.json, jobs.json으로 저장하는 스크립트
 * 
 * 실행: node tools/extract-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const htmlPath = join(ROOT, 'apps', 'web', 'index.html');
const outDir = join(ROOT, 'apps', 'web', 'src', 'data');

mkdirSync(outDir, { recursive: true });

const html = readFileSync(htmlPath, 'utf8');

// ─────────────────────────────────────────────
// 1. RegionData 추출
// ─────────────────────────────────────────────
const regionStart = html.indexOf('const RegionData = {');
const regionBlockStart = html.indexOf('{', regionStart);

// 중괄호 매칭으로 블록 끝 찾기
let depth = 0, i = regionBlockStart, regionEnd = -1;
while (i < html.length) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') {
    depth--;
    if (depth === 0) { regionEnd = i + 1; break; }
  }
  i++;
}

const regionRaw = html.slice(regionBlockStart, regionEnd);

// JS 객체 → JSON: eval을 안전하게 사용 (서버 사이드 스크립트)
let RegionData;
try {
  RegionData = Function(`"use strict"; return (${regionRaw})`)();
} catch (e) {
  console.error('RegionData 파싱 실패:', e.message);
  process.exit(1);
}

// regions.json 형식으로 변환 (명세서 §4.3 기준)
// 지역별 기본 정보 (WorldMap 이미지, 사냥터 목록)
const regionsJson = Object.entries(RegionData).map(([name, data]) => ({
  name,
  worldMapImg: data.worldMapImg,
  huntingGrounds: (data.huntingGrounds || []).map(hg => ({
    name: hg.name,
    x: hg.x,
    y: hg.y,
    mapImg: hg.mapImg,
    hitboxImg: hg.mapImg ? hg.mapImg.replace('/images/', '/Hitbox/') : null,
    realW: hg.realW,
    realH: hg.realH,
    force: hg.force,
    bgm: hg.bgm || null,
    // 몬스터 정보
    mob: hg.mob || null,
    mobLv: hg.mobLv || null,
    mobCount: hg.mobCount || null,
    mobExp: hg.exp || hg.mobexp || null,
    mobHp: hg.hp || hg.mobhp || null,
    mobImg: hg.mobImg || null,
    mob2: hg.mob2 || null,
    mobLv2: hg.mobLv2 || null,
    mob2Exp: hg.mob2exp || null,
    mob2Hp: hg.mob2hp || null,
    mobImg2: hg.mobImg2 || null,
  }))
}));

writeFileSync(join(outDir, 'regions.json'), JSON.stringify(regionsJson, null, 2), 'utf8');
console.log(`✅ regions.json 저장 완료: ${regionsJson.length}개 지역`);
regionsJson.forEach(r => console.log(`   - ${r.name}: ${r.huntingGrounds.length}개 사냥터`));

// ─────────────────────────────────────────────
// 2. JobDatabase 추출
// ─────────────────────────────────────────────
const jobStart = html.indexOf('\nconst JobDatabase = {');
const jobBlockStart = html.indexOf('{', jobStart);

depth = 0; i = jobBlockStart; let jobEnd = -1;
while (i < html.length) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') {
    depth--;
    if (depth === 0) { jobEnd = i + 1; break; }
  }
  i++;
}

const jobRaw = html.slice(jobBlockStart, jobEnd);

let JobDatabase;
try {
  JobDatabase = Function(`"use strict"; return (${jobRaw})`)();
} catch (e) {
  console.error('JobDatabase 파싱 실패:', e.message);
  process.exit(1);
}

writeFileSync(join(outDir, 'jobs.json'), JSON.stringify(JobDatabase, null, 2), 'utf8');

const totalJobs = Object.values(JobDatabase).flat().length;
console.log(`✅ jobs.json 저장 완료: ${Object.keys(JobDatabase).length}개 직군, ${totalJobs}개 직업`);

console.log('\n🎉 데이터 추출 완료!');
