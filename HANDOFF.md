# Handoff & Project Status

## 1. 완료된 작업 (Completed Tasks)

- **AI Proxy 우회 및 고정 (`perplexity-webui-scraper`)**
  - `completions.py`: 모델을 `anthropic/claude-sonnet-5-thinking`으로 강제 할당
  - `account.py`: `ModelAccessError` 우회 처리

- **메이플 캔버스 오류 수정 (`apps/web/index.html`)**
  - 삭제된 4,400여 줄 인라인 JS 복구 (사냥터/직업/스킬 데이터 및 UI 로직)
  - 인코딩 오염(C1 제어문자, EUC-KR/UTF-8 혼재) 수정 → Vite 빌드 정상화
  - 버튼 인자와 RegionData 키 불일치 수정 → 어센틱 삼풀 지역 버튼 정상화

- **모노레포 Git 환경**
  - `vibemcpcanvas-del/mp1` GitHub 저장소 `main` 브랜치 연동
  - `apps/web` → `.github/workflows/pages.yml` 기반 GitHub Pages 자동 CI/CD 동작 중

- **센서 계층 전체 구현 완료**
  - `CoordinateSensor.js`, `MockSensor.js`, `PositionFilter.js`, `WebSocketSensor.js`
  - `CoordinateMapper.js`, `Calibration.js` 로직 완료

---

## 2. 로드맵 (Next Steps)

> 명세서 v1.2 기준. Figma 파이프라인(구 §7)은 제거됨.

### 단계 3 — Renderer + 레이어 전체 + 디자인 토큰
**파일 변경 목록:**

| 작업 | 파일 | 내용 |
|------|------|------|
| [NEW] | `apps/web/src/canvas/layers/MapLayer.js` | 사냥터 배경 이미지 Canvas 렌더링. `map-bg` 토큰으로 로딩 전 배경. `setImage(url)` 비동기 로드 |
| [NEW] | `apps/web/src/canvas/layers/HitboxLayer.js` | 히트박스 JSON 배열 → Canvas 렌더링. `hitbox-stroke`/`hitbox-fill` 토큰. `setHitboxes(arr)` / `clear()` |
| [MODIFY] | `apps/web/src/canvas/Renderer.js` | 레이어 순서: `MapLayer → HitboxLayer → PlayerLayer`. `mp1:mapExited` 시 `_resizeObserver.disconnect()` 누수 수정 |
| [FIX] | `apps/web/src/canvas/layers/PlayerLayer.js` | Trail 버그: `_trail.push()` 를 `render()` 안이 아닌 `onPosition()` 호출 시점에만 수행 |
| [MODIFY] | `packages/design-tokens/tokens.json` | 상태 dot 색상(`status-connected/reconnecting/disconnected`), 마커 반지름, 트레일 선 굵기 토큰 추가 |

커밋 메시지:
```
feat: [단계3] MapLayer — 배경 이미지 렌더링
feat: [단계3] HitboxLayer — 히트박스 Canvas 렌더링
feat: [단계3] Renderer 레이어 스택 완성 + ResizeObserver 누수 수정
fix:  [단계3] PlayerLayer trail 버그 수정 (60fps → 센서 속도)
feat: [단계3] tokens.json 확장
```

---

### 단계 4 — MapManager 보완 + main.js 연결

| 작업 | 파일 | 내용 |
|------|------|------|
| [MODIFY] | `packages/core/src/MapManager.js` | `hitboxImg`→`hitboxDataUrl` 필드 정규화(regions.json 수정 없이). `setRegion()` 히트박스 JSON `fetch()` 비동기 로딩 추가. `regionChanged` 이벤트에 hitboxes 포함 |
| [MODIFY] | `apps/web/src/main.js` | `WebSocketSensor.onRegionChange` → `mapManager.setRegion()` 연결. `mp1:mapExited` 정리 로직 보완(누수 제거). `huntingGroundChanged` → `renderer.onRegionChange()` 연결 |

커밋 메시지:
```
feat: [단계4] MapManager 히트박스 비동기 로딩 + 필드명 정규화
fix:  [단계4] main.js WS regionChange 연결 + 누수 수정
```

---

### 단계 6 — Calibration UI 연결

| 작업 | 파일 | 내용 |
|------|------|------|
| [MODIFY] | `apps/web/src/main.js` | 캘리브레이션 모드 버튼 → Canvas 클릭으로 `Calibration.addPoint()` 수집. 2점 완료 시 인디케이터. `WebSocketSensor` 수신 좌표에 `calibration.apply()` 적용 |

커밋 메시지:
```
feat: [단계6] Calibration UI 연결 (2점 보정 모드)
```

---

## 3. 오픈 퀘스천 (구현 전 확인 필요)

> ⚠️ 아래 항목은 확인 전 임의 구현 금지

1. **히트박스 JSON** (`apps/web/src/data/hitboxes/*.json`) — 이미 존재하는 파일이 있나요, 아니면 이번에 새로 만들어야 하나요? (Figma 파이프라인 제거 이후 소스 불명)
2. **배경 이미지** (`hg.mapImg = ./images/Cernium/Cernium_1.webp` 등) — `apps/web/public/` 하위에 실제로 있나요?
3. **Calibration UI 위치** — 기존 `sensor-panel` 안에 버튼 추가 vs 별도 패널 분리?

---

## 4. 구조 요약 (Repository Structure)

```
mp1/
├── apps/web/          ← 메이플스토리 캔버스 시뮬레이터 (GitHub Pages 자동 배포)
│   └── src/
│       ├── main.js
│       ├── canvas/    ← Renderer + 레이어 (단계3에서 완성 예정)
│       └── data/      ← regions.json, hitboxes/
├── packages/
│   ├── sensors/       ← ✅ 완료
│   ├── core/          ← 부분 완료 (MapManager 보완 필요)
│   └── design-tokens/ ← tokens.json (단계3에서 확장 예정)
└── perplexity-webui-scraper/  ← AI 프록시 (모델 영역, CI/CD 미정)
```
