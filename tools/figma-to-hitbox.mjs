/**
 * figma-to-hitbox.mjs
 * Figma REST API → 히트박스 JSON 추출 파이프라인 (스켈레톤)
 * 
 * 실행: FIGMA_TOKEN=xxx node tools/figma-to-hitbox.mjs --file <figma-file-key>
 * 
 * 출력: apps/web/src/data/hitboxes/{region}.json
 *   형식: [{ "name": "hitbox-mob-01", "x": 0, "y": 0, "w": 100, "h": 50 }]
 * 
 * 현재 히트박스 오버레이 이미지(/Hitbox/*)가 이미 존재하므로,
 * 이 스크립트는 향후 Figma 기반 JSON 파이프라인 전환을 위한 스켈레톤입니다.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const args = process.argv.slice(2);
const fileKeyIdx = args.indexOf('--file');
const FIGMA_FILE_KEY = fileKeyIdx !== -1 ? args[fileKeyIdx + 1] : null;

if (!FIGMA_TOKEN) {
  console.error('❌ 환경변수 FIGMA_TOKEN 이 설정되지 않았습니다.');
  console.error('   사용법: FIGMA_TOKEN=xxx node tools/figma-to-hitbox.mjs --file <file-key>');
  process.exit(1);
}
if (!FIGMA_FILE_KEY) {
  console.error('❌ --file <figma-file-key> 인수가 필요합니다.');
  process.exit(1);
}

const outDir = join(ROOT, 'apps', 'web', 'src', 'data', 'hitboxes');
mkdirSync(outDir, { recursive: true });

/**
 * Figma API 파일 데이터 가져오기
 */
async function fetchFigmaFile(fileKey) {
  const url = `https://api.figma.com/v1/files/${fileKey}`;
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }
  });
  if (!res.ok) {
    throw new Error(`Figma API 오류: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * 노드 트리를 재귀 순회하여 'hitbox-'로 시작하는 레이어 추출
 * @param {object} node
 * @param {object[]} results
 */
function extractHitboxNodes(node, results = []) {
  if (node.name && node.name.startsWith('hitbox-') && node.absoluteBoundingBox) {
    const { x, y, width, height } = node.absoluteBoundingBox;
    results.push({ name: node.name, x, y, w: width, h: height });
  }
  if (node.children) {
    node.children.forEach(child => extractHitboxNodes(child, results));
  }
  return results;
}

async function main() {
  console.log(`📐 Figma 파일 읽는 중: ${FIGMA_FILE_KEY}`);
  const data = await fetchFigmaFile(FIGMA_FILE_KEY);
  const pages = data.document.children;

  let totalHitboxes = 0;

  for (const page of pages) {
    const regionName = page.name; // Figma 페이지 이름 = 지역 이름
    const hitboxes = extractHitboxNodes(page);

    if (hitboxes.length === 0) {
      console.log(`  ⚠️  "${regionName}": hitbox- 노드 없음, 건너뜀`);
      continue;
    }

    const outFile = join(outDir, `${regionName}.json`);
    writeFileSync(outFile, JSON.stringify(hitboxes, null, 2), 'utf8');
    console.log(`  ✅ "${regionName}": ${hitboxes.length}개 히트박스 → ${outFile}`);
    totalHitboxes += hitboxes.length;
  }

  console.log(`\n🎉 완료: ${pages.length}개 페이지, 총 ${totalHitboxes}개 히트박스 추출`);
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
