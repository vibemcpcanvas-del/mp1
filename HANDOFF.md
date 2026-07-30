# Handoff & Project Status

## 1. 완료된 작업 (Completed Tasks)

- **AI Proxy 우회 및 고정 (`perplexity-webui-scraper`)**
  - `completions.py`: 모델을 `anthropic/claude-sonnet-5-thinking`으로 강제 할당
  - `account.py`: `ModelAccessError` 우회 처리

- **메이플 캔버스 오류 수정 (`apps/web/index.html`)**
  - 삭제된 4,400여 줄 인라인 JS 복구
  - 인코딩 오염 수정 → Vite 빌드 정상화
  - 버튼 인자 ↔ RegionData 키 불일치 수정 → 전체 버튼 정상화

- **모노레포 Git 환경**
  - `vibemcpcanvas-del/mp1` GitHub Pages 자동 CI/CD 동작 중

- **센서 계층 전체 구현 완료**
  - `CoordinateSensor`, `MockSensor`, `PositionFilter`, `WebSocketSensor` ✅
  - `CoordinateMapper`, `Calibration` 로직 ✅

---

## 2. 아키텍처 결정사항 (Opus 검토 확정)

| 항목 | 결정 |
|------|------|
| HitboxLayer | `hitboxImg` PNG를 `drawImage`로 Canvas 오버레이 (JSON 폴리곤 불필요) |
| Calibration UX | **Freeze & Click**: [캡처] 버튼으로 visionX/Y 고정 → Canvas 클릭으로 worldX/Y 추출 |
| regions.json 필드명 | MapManager 별칭처리 `hg.hitboxDataUrl ?? hg.hitboxImg` (원본 JSON 수정 없음) |

---

## 3. 로드맵 (잔여 작업)

### 단계 3 — Renderer + 레이어 + 디자인 토큰

| 작업 | 파일 |
|------|------|
| [NEW] | `apps/web/src/canvas/layers/MapLayer.js` — 배경 PNG `drawImage`, map-bg 토큰으로 로딩 전 배경 |
| [NEW] | `apps/web/src/canvas/layers/HitboxLayer.js` — `hitboxImg` PNG `drawImage`, 반투명 오버레이 |
| [MODIFY] | `apps/web/src/canvas/Renderer.js` — 레이어 순서 MapLayer→HitboxLayer→PlayerLayer, ResizeObserver 누수 수정 |
| [FIX] | `apps/web/src/canvas/layers/PlayerLayer.js` — trail.push()를 render()가 아닌 onPosition()에서 |
| [MODIFY] | `packages/design-tokens/tokens.json` — status-connected/reconnecting/disconnected, marker-radius, trail-width 추가 |

```
feat: [단계3] MapLayer — 배경 이미지 렌더링
feat: [단계3] HitboxLayer — hitboxImg PNG Canvas 오버레이
feat: [단계3] Renderer 레이어 스택 완성 + ResizeObserver 누수 수정
fix:  [단계3] PlayerLayer trail 버그 수정 (60fps → 센서 속도)
feat: [단계3] tokens.json 확장
```

---

### 단계 4 — MapManager + main.js 연결

| 작업 | 파일 |
|------|------|
| [MODIFY] | `packages/core/src/MapManager.js` — `hg.hitboxDataUrl ?? hg.hitboxImg` 별칭, `setRegion()` hitbox 비동기 로딩 |
| [MODIFY] | `apps/web/src/main.js` — WS regionChange→mapManager.setRegion() 연결, exit 정리, huntingGroundChanged→renderer.onRegionChange() |

```
feat: [단계4] MapManager 히트박스 비동기 로딩 + 필드명 정규화
fix:  [단계4] main.js WS regionChange 연결 + 누수 수정
```

---

### 단계 5 — UI 정리 + Calibration 패널

| 작업 | 파일 |
|------|------|
| [FIX] | `apps/web/index.html` — 구버전 #sensor-panel 제거 (5515~5524번 줄), 캘리브레이션 버튼 추가 |
| [NEW] | `#calibration-panel` HTML — Freeze & Click UX (캡처 버튼 × 2, Canvas 클릭 → addPoint) |
| [MODIFY] | `apps/web/src/main.js` — Calibration UI 로직 연결, WS 좌표에 calibration.apply() 적용 |

**Freeze & Click 흐름:**
1. 게임 내 캐릭터를 랜드마크에 세움 → WS가 visionX/Y 수신 중
2. [1번 캡처] 클릭 → 현재 visionX/Y 메모리 고정
3. Canvas에서 동일 랜드마크 클릭 → CoordinateMapper.unmap() → worldX/Y → addPoint()
4. 2번 반복 → [완료] → calibration.apply() 활성화

```
fix:  [단계5] index.html 중복 sensor-panel 제거
feat: [단계5] calibration-panel UI (Freeze & Click)
feat: [단계5] main.js Calibration 로직 연결
```

---

## 4. 구조 요약

```
mp1/
├── apps/web/          ← GitHub Pages 자동 배포 (main 브랜치 push → 빌드)
│   └── src/canvas/layers/
│       ├── MapLayer.js       ← [단계3 신규]
│       ├── HitboxLayer.js    ← [단계3 신규] PNG drawImage 방식
│       └── PlayerLayer.js    ← [단계3 버그수정]
├── packages/
│   ├── sensors/       ← ✅ 완료
│   ├── core/          ← MapManager 보완 필요 [단계4]
│   └── design-tokens/ ← tokens.json 확장 필요 [단계3]
└── perplexity-webui-scraper/  ← AI 프록시 (모델 영역, CI/CD 추후 결정)
```
