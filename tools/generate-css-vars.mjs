/**
 * generate-css-vars.mjs
 * packages/design-tokens/tokens.json → apps/web/src/ui/tokens.css 변환
 * 
 * 실행: node tools/generate-css-vars.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const tokensPath = join(ROOT, 'packages', 'design-tokens', 'tokens.json');
const outPath = join(ROOT, 'apps', 'web', 'src', 'ui', 'tokens.css');

mkdirSync(join(ROOT, 'apps', 'web', 'src', 'ui'), { recursive: true });

const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

/**
 * JSON 토큰 객체를 CSS 변수 선언으로 재귀 변환
 * @param {object} obj
 * @param {string} prefix
 * @returns {string[]}
 */
function flattenToCssVars(obj, prefix = '--mp1') {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    const varName = `${prefix}-${key}`;
    if (typeof value === 'object' && value !== null) {
      lines.push(...flattenToCssVars(value, varName));
    } else {
      lines.push(`  ${varName}: ${value};`);
    }
  }
  return lines;
}

const vars = flattenToCssVars(tokens);
const css = `/**
 * tokens.css — @mp1/design-tokens 에서 자동 생성
 * 수동 편집 금지. tokens.json을 수정한 뒤 generate-css-vars.mjs를 실행하세요.
 * 생성일: ${new Date().toISOString()}
 */
:root {
${vars.join('\n')}
}
`;

writeFileSync(outPath, css, 'utf8');
console.log('✅ tokens.css 생성 완료:', outPath);
console.log('   생성된 변수 목록:');
vars.forEach(v => console.log('  ', v.trim()));
