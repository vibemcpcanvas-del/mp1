/**
 * main.js — MP1 시뮬레이터 앱 조립 진입점
 *
 * 역할: VisionSensor / RouteManager / CommandBus 생성 → MapManager 초기화 →
 *       Renderer 연결 → TabManager / RouteEditor / CaptchaMonitor UI 연결
 *
 * 기존 DOM UI(사냥터 선택, 스킬 배치 등)는 기존 inline script가 그대로 처리.
 * 이 파일은 Canvas 오버레이 레이어와 봇 파이프라인을 담당한다.
 *
 * @module main
 */
import { VisionSensor } from '@sensors/VisionSensor.js';
import { PositionFilter } from '@sensors/PositionFilter.js';
import { MapManager } from '@core/MapManager.js';
import { RouteManager } from '@core/RouteManager.js';
import { Renderer } from './canvas/Renderer.js';
import { VisionRenderer } from './canvas/VisionRenderer.js';
import { initGlassHUD } from './core/GlassHUDManager.js';
import { CommandBus } from './net/CommandBus.js';
import { TabManager } from './ui/TabManager.js';
import { RouteEditor } from './ui/RouteEditor.js';
import { CaptchaMonitor } from './ui/CaptchaMonitor.js';
import regionsData from './data/regions.json';

// ─── 전역 인스턴스 ──────────────────────────────────────────────
let renderer = null;
let visionRenderer = null;
let mapManager = null;

/** WS 전용 센서 (캘리브레이션/레이어 토글용으로만 사용) */
let activeSensor = null;
let sensorRunning = false;

/** VisionSensor — LIVE 탭 전환 시 생성, MAP 탭 전환 시 소멸 */
let visionSensor = null;

let captchaMonitor = null;
let tabManager = null;
let routeEditor = null;

let currentTool = 'select'; // 'select' | 'pin'
let isFrameFrozen = false;

const globalPositionFilter = new PositionFilter({ alpha: 0.3, enabled: true });

/** RouteManager — 전역 단일 인스턴스 */
const routeManager = new RouteManager();

/** CommandBus — 전역 단일 인스턴스 */
const commandBus = new CommandBus({ url: 'ws://localhost:8765' });

// ─── 초기화 ────────────────────────────────────────────────────
function init() {
  mapManager = new MapManager(regionsData);

  mapManager.addEventListener('huntingGroundChanged', () => {
    if (renderer) renderer.onRegionChange();
  });

  hookLegacyMapEvents();
  initTabManager();
  setupSensorPanel();
  setupCalibrationPanel();
  setupWorkspaceTools();
  setupScreenShare();
}

// ─── TabManager 초기화 ─────────────────────────────────────────
function initTabManager() {
  tabManager = new TabManager({
    onSwitchToLive: () => {
      // VisionSensor 시작 (live-game-video / live-vision-overlay 사용)
      const videoEl   = document.getElementById('live-game-video');
      const overlayEl = document.getElementById('live-vision-overlay');
      const modelUrl  = window._mp1ModelUrl || '';
      const apiKey    = window._mp1ApiKey   || '';

      if (videoEl && overlayEl) {
        visionSensor = new VisionSensor({ modelUrl, apiKey, videoEl, overlayCanvasEl: overlayEl });
        visionSensor.onDetection = (data) => captchaMonitor?.check(data);
        visionSensor.subscribe(pos => {
          window._lastRawVisionPos = { x: pos.x, y: pos.y };
          let finalPos = pos;
          if (mapManager?.calibration?.isCalibrated) {
            const cal = mapManager.calibration.apply(pos.x, pos.y);
            if (cal) finalPos = { ...pos, x: cal.worldX, y: cal.worldY };
          }
          if (renderer) renderer.onPosition(finalPos);

          // RouteManager tick — 웨이포인트 도달 판정
          const tick = routeManager.tick(finalPos.x, finalPos.y);
          if (tick.triggered && tick.skillKey) {
            commandBus.send({ type: 'KEY', key: tick.skillKey });
          }
        });
        visionSensor.start();
      }

      commandBus.connect();

      captchaMonitor = new CaptchaMonitor({
        commandBus,
        onAlert: () => {
          const banner = document.getElementById('captcha-alert-banner');
          if (banner) {
            banner.style.display = 'flex';
            setTimeout(() => { banner.style.display = 'none'; }, 5000);
          }
        },
      });

      // 현재 regionId로 route 복원
      if (window.currentRegionName) routeManager.load(window.currentRegionName);
    },

    onSwitchToMap: () => {
      visionSensor?.stop();
      visionSensor = null;
      commandBus.disconnect();
    },
  });

  tabManager.init();

  // index.html의 onclick에서도 참조할 수 있도록 전역 노출
  window.tabManager = tabManager;
}

/**
 * 기존 inline script의 enterMap/goBack 함수에 Canvas 오버레이 연동
 */
function hookLegacyMapEvents() {
  const pollForLegacy = setInterval(() => {
    if (typeof window.enterMap === 'function' && typeof window.goBack === 'function') {
      clearInterval(pollForLegacy);

      const origEnterMap = window.enterMap;
      window.enterMap = function(huntingGround) {
        origEnterMap.apply(this, arguments);
        window.dispatchEvent(new CustomEvent('mp1:mapEntered', {
          detail: { huntingGround }
        }));

        if (!window._hudInitialized) {
          initGlassHUD();
          window._hudInitialized = true;
        }
      };

      const origGoBack = window.goBack;
      window.goBack = function() {
        origGoBack.apply(this, arguments);
        window.dispatchEvent(new CustomEvent('mp1:mapExited'));
      };

      console.debug('[main] 레거시 함수 후킹 완료');
    }
  }, 100);

  window.addEventListener('mp1:mapEntered', (e) => {
    const canvas = document.getElementById('tracker-canvas');
    if (!canvas) return;

    const hg = e.detail.huntingGround;
    if (!hg) return;

    const regionName = window.currentRegionName;
    if (regionName) mapManager.setRegion(regionName);
    mapManager.setHuntingGround(hg);

    if (!renderer) {
      renderer = new Renderer(canvas, mapManager);
    }
    const visionCanvas = document.getElementById('vision-overlay-canvas');
    if (visionCanvas && !visionRenderer) {
      visionRenderer = new VisionRenderer(visionCanvas);
      visionRenderer.isFrozen = isFrameFrozen;
    }

    renderer.onRegionChange();

    // RouteLayer / SkillLayer 에 현재 웨이포인트 공급
    if (renderer.routeLayer) renderer.routeLayer.setWaypoints(routeManager.getWaypoints());
    if (renderer.skillLayer) renderer.skillLayer.setWaypoints(routeManager.getWaypoints());

    renderer.start();
    if (visionRenderer) visionRenderer.start();

    const panel = document.getElementById('sensor-panel');
    const divider = document.getElementById('mp1-control-divider');
    if (panel) panel.style.display = 'flex';
    if (divider) divider.style.display = 'flex';

    if (activeSensor && sensorRunning) {
      activeSensor.stop();
      activeSensor.start();
    }

    // RouteEditor 초기화 (mapEntered 시점)
    routeEditor = new RouteEditor({ routeManager, renderer });
    routeEditor.init();

    // tracker-canvas 클릭 이벤트에 RouteEditor 연결
    const trackerCanvas = document.getElementById('tracker-canvas');
    if (trackerCanvas) {
      trackerCanvas.addEventListener('click', _onTrackerClick);
      trackerCanvas.addEventListener('contextmenu', _onTrackerContextMenu);
    }

    // 경로 편집 모드 토글
    window._mp1ToggleRouteEdit = () => {
      window._mp1RouteEditMode = !window._mp1RouteEditMode;
      const btn = document.getElementById('route-edit-toggle-btn');
      if (btn) btn.classList.toggle('active', window._mp1RouteEditMode);
    };

    // 배치 완료 버튼
    window._mp1DeployBot = () => {
      if (window.currentRegionName) routeManager.save(window.currentRegionName);
      tabManager?.switchTo('live');
    };

    console.debug('[main] Canvas Renderer 시작:', hg.name);
  });

  window.addEventListener('mp1:mapExited', () => {
    const trackerCanvas = document.getElementById('tracker-canvas');
    if (trackerCanvas) {
      trackerCanvas.removeEventListener('click', _onTrackerClick);
      trackerCanvas.removeEventListener('contextmenu', _onTrackerContextMenu);
    }

    if (renderer) {
      if (typeof renderer.destroy === 'function') renderer.destroy();
      else renderer.stop();
      renderer = null;
    }
    if (visionRenderer) {
      visionRenderer.stop();
      visionRenderer = null;
    }
    if (activeSensor) {
      activeSensor.stop();
      sensorRunning = false;
    }
    const panel = document.getElementById('sensor-panel');
    const divider = document.getElementById('mp1-control-divider');
    if (panel) panel.style.display = 'none';
    if (divider) divider.style.display = 'none';

    updateSensorUI('disconnected', 'WS 연결');
  });
}

/** tracker-canvas 좌클릭 — 경로 편집 모드에서 웨이포인트 추가 */
function _onTrackerClick(e) {
  if (!window._mp1RouteEditMode || !routeEditor) return;
  e.preventDefault();
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const worldPos = mapManager?.mapper?.unmap(px, py);
  if (worldPos) routeEditor.onMapClick(worldPos.worldX ?? worldPos.x, worldPos.worldY ?? worldPos.y);
}

/** tracker-canvas 우클릭 — 경로 편집 모드에서 스킬 키 지정 */
function _onTrackerContextMenu(e) {
  e.preventDefault();
  if (!window._mp1RouteEditMode || !routeEditor) return;
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const worldPos = mapManager?.mapper?.unmap(px, py);
  if (worldPos) routeEditor.onMapRightClick(worldPos.worldX ?? worldPos.x, worldPos.worldY ?? worldPos.y);
}

// ─── 센서 패널 UI ───────────────────────────────────────────────
function setupSensorPanel() {
  // WS 모드만 지원
  window._mp1SetSensorMode = (mode) => {
    if (sensorRunning && activeSensor) {
      activeSensor.stop();
      activeSensor = null;
      sensorRunning = false;
    }
    globalPositionFilter.reset();
    const wsBtn = document.getElementById('sensor-ws-btn');
    if (wsBtn) wsBtn.classList.toggle('active', mode === 'ws');
    updateSensorUI('disconnected', 'WS 연결');
  };

  // PositionFilter ON/OFF 토글
  window._mp1TogglePositionFilter = (enabled) => {
    globalPositionFilter.enabled = enabled;
    console.debug('[main] PositionFilter enabled:', enabled);
  };

  // PositionFilter EMA Alpha 설정
  window._mp1SetFilterAlpha = (alphaVal) => {
    globalPositionFilter.alpha = alphaVal;
    const valLabel = document.getElementById('filter-alpha-val');
    if (valLabel) valLabel.textContent = alphaVal.toFixed(2);
    console.debug('[main] PositionFilter alpha set to:', alphaVal);
  };

  // WS 센서 토글
  window._mp1SensorToggle = () => {
    if (!renderer || !mapManager) return;

    if (sensorRunning && activeSensor) {
      activeSensor.stop();
      activeSensor = null;
      sensorRunning = false;
      updateSensorUI('disconnected', 'WS 연결');
      return;
    }

    activeSensor = new WebSocketSensor({ url: 'ws://localhost:8765', filter: globalPositionFilter });
    activeSensor.onStatusChange((status) => {
      const labelMap = {
        connected:    'WS 연결 끊기',
        connecting:   'WS 연결 끊기',
        reconnecting: 'WS 연결 끊기',
        disconnected: 'WS 연결',
      };
      updateSensorUI(status, labelMap[status] || 'WS 연결');
    });
    activeSensor.onRegionChange((regionName) => {
      mapManager.setRegion(regionName);
    });

    activeSensor.subscribe(pos => {
      if (!isFrameFrozen) {
        window._lastRawVisionPos = { x: pos.x, y: pos.y };
        if (visionRenderer) {
          visionRenderer.onPosition(pos);
        }
      }

      const filtered = globalPositionFilter.process(pos);
      if (filtered === null) return;

      let finalPos = filtered;
      if (mapManager && mapManager.calibration && mapManager.calibration.isCalibrated) {
        const cal = mapManager.calibration.apply(filtered.x, filtered.y);
        if (cal) {
          finalPos = { ...filtered, x: cal.worldX, y: cal.worldY };
        }
      }
      if (renderer) renderer.onPosition(finalPos);
    });
    activeSensor.start();
    sensorRunning = true;
  };

  window._mp1TrailToggle = () => {
    if (!renderer) return;
    const layer = renderer.playerLayer;
    layer.showTrail = !layer.showTrail;
    const btn = document.getElementById('trail-toggle-btn');
    if (btn) btn.textContent = layer.showTrail ? '궤적 표시 ✓' : '궤적 숨기기';
  };

  // ── 레이어 가시성 & 투명도 바인딩 ──
  window._mp1SetHitboxVisibility = (visible) => {
    if (renderer) renderer.setLayerVisibility('hitbox', visible);
  };
  window._mp1SetHitboxOpacity = (opacity) => {
    if (renderer) renderer.setLayerOpacity('hitbox', opacity);
  };
  window._mp1SetMapVisibility = (visible) => {
    if (renderer) renderer.setLayerVisibility('map', visible);
  };
  window._mp1SetMapOpacity = (opacity) => {
    if (renderer) renderer.setLayerOpacity('map', opacity);
  };
  window._mp1SetPlayerVisibility = (visible) => {
    if (renderer) renderer.setLayerVisibility('player', visible);
  };
  window._mp1SetPlayerOpacity = (opacity) => {
    if (renderer) renderer.setLayerOpacity('player', opacity);
  };
}

// ─── 캘리브레이션 UI 로직 ───────────────────────────────────────
function setupCalibrationPanel() {
  window._calData = {
    p1: { vision: null, world: null },
    p2: { vision: null, world: null },
  };

  let activeCalPoint = 1;

  function setFrameFrozen(frozen) {
    isFrameFrozen = frozen;
    if (visionRenderer) {
      visionRenderer.isFrozen = frozen;
    }
    const video = document.getElementById('game-screen-video');
    if (video) {
      if (frozen) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    }
    const btn = document.getElementById('cal-freeze-btn');
    if (btn) {
      btn.textContent = isFrameFrozen ? 'Unfreeze Frame' : 'Freeze Frame';
      btn.style.background = isFrameFrozen ? 'rgba(0,243,255,0.4)' : 'rgba(0,243,255,0.15)';
    }
  }

  window._mp1ToggleFreezeFrame = () => {
    setFrameFrozen(!isFrameFrozen);
  };

  window._mp1SelectCalPoint = (step) => {
    activeCalPoint = step;
    updateCalUI();
  };

  window._mp1ClearCalibration = () => {
    if (mapManager && mapManager.calibration) {
      mapManager.calibration.reset();
      window._calData.p1 = { vision: null, world: null };
      window._calData.p2 = { vision: null, world: null };
      activeCalPoint = 1;
      updateCalUI();
      alert('보정이 초기화되었습니다.');
    }
  };

  window._mp1CalibrationStart = () => {
    const sp = document.getElementById('sensor-panel');
    const cp = document.getElementById('calibration-panel');
    if (sp) sp.style.display = 'none';
    if (cp) cp.style.display = 'flex';

    window._isCalibrationMode = true;
    window._calData.p1 = { vision: null, world: null };
    window._calData.p2 = { vision: null, world: null };
    activeCalPoint = 1;
    setFrameFrozen(false);

    updateCalUI();
    window._mp1SelectTool('pin'); // 캘리브레이션 진입 시 핀 도구 활성화

    const trackerCanvas = document.getElementById('tracker-canvas');
    const visionCanvas = document.getElementById('vision-overlay-canvas');
    if (trackerCanvas) {
      trackerCanvas.style.cursor = 'crosshair';
      trackerCanvas.addEventListener('click', onTrackerCanvasClick);
    }
    if (visionCanvas) {
      visionCanvas.classList.add('calibration-active');
      visionCanvas.style.pointerEvents = 'auto';
      visionCanvas.style.cursor = 'crosshair';
      visionCanvas.addEventListener('click', onVisionCanvasClick);
    }
  };

  const onVisionCanvasClick = (e) => {
    if (!window._isCalibrationMode || currentTool !== 'pin') return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();

    // 비전 캔버스는 가상 해상도 (e.g. 1366x768)로 매핑. DPR 스케일링 보정
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;

    const vx = (e.clientX - rect.left) * scaleX;
    const vy = (e.clientY - rect.top) * scaleY;

    if (activeCalPoint === 1) {
      window._calData.p1.vision = { x: vx, y: vy };
      if (!window._calData.p2.vision) {
        activeCalPoint = 2;
      }
    } else {
      window._calData.p2.vision = { x: vx, y: vy };
      if (!window._calData.p1.vision) {
        activeCalPoint = 1;
      }
    }
    updateCalUI();
  };

  const onTrackerCanvasClick = (e) => {
    if (!window._isCalibrationMode || currentTool !== 'pin' || !renderer || !mapManager) return;

    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const mapper = mapManager.mapper;
    if (!mapper) return;
    const worldPos = mapper.unmap(px, py);

    if (activeCalPoint === 1) {
      window._calData.p1.world = worldPos;
      if (!window._calData.p2.world) {
        activeCalPoint = 2;
      }
    } else {
      window._calData.p2.world = worldPos;
      if (!window._calData.p1.world) {
        activeCalPoint = 1;
      }
    }
    updateCalUI();
  };

  window._mp1CalibrationCapture = (step) => {
    activeCalPoint = step;
    if (!window._lastRawVisionPos) {
      alert('센서에서 좌표를 수신받지 못했습니다.');
      updateCalUI();
      return;
    }
    const { x, y } = window._lastRawVisionPos;
    if (step === 1) {
      window._calData.p1.vision = { x, y };
      if (!window._calData.p2.vision) activeCalPoint = 2;
    } else {
      window._calData.p2.vision = { x, y };
      if (!window._calData.p1.vision) activeCalPoint = 1;
    }
    updateCalUI();
  };

  window._mp1CalibrationCancel = () => {
    closeCalibrationPanel();
    window._mp1SelectTool('select');
  };

  window._mp1CalibrationDone = () => {
    const { p1, p2 } = window._calData;
    if (p1.vision && p1.world && p2.vision && p2.world) {
      const cal = mapManager.calibration;
      if (cal) {
        cal.addPoint(p1.vision.x, p1.vision.y, p1.world.x, p1.world.y);
        cal.addPoint(p2.vision.x, p2.vision.y, p2.world.x, p2.world.y);
        alert('캘리브레이션이 저장되었습니다.');
      }
    }
    closeCalibrationPanel();
    window._mp1SelectTool('select');
  };

  function closeCalibrationPanel() {
    window._isCalibrationMode = false;
    setFrameFrozen(false);

    const sp = document.getElementById('sensor-panel');
    const cp = document.getElementById('calibration-panel');
    if (sp) sp.style.display = 'flex';
    if (cp) cp.style.display = 'none';

    const trackerCanvas = document.getElementById('tracker-canvas');
    const visionCanvas = document.getElementById('vision-overlay-canvas');
    if (trackerCanvas) {
      trackerCanvas.style.cursor = 'default';
      trackerCanvas.removeEventListener('click', onTrackerCanvasClick);
    }
    if (visionCanvas) {
      visionCanvas.classList.remove('calibration-active');
      visionCanvas.style.pointerEvents = 'none';
      visionCanvas.style.cursor = 'default';
      visionCanvas.removeEventListener('click', onVisionCanvasClick);
    }
  }

  function updateCalUI() {
    const { p1, p2 } = window._calData;

    const setLabel = (id, data, format) => {
      const el = document.getElementById(id);
      if (el) el.textContent = data ? format(data) : '(미설정)';
    };

    setLabel('cal-p1-vision', p1.vision, d => `${Math.round(d.x)}, ${Math.round(d.y)}`);
    setLabel('cal-p1-world', p1.world, d => `${Math.round(d.x)}, ${Math.round(d.y)}`);
    setLabel('cal-p2-vision', p2.vision, d => `${Math.round(d.x)}, ${Math.round(d.y)}`);
    setLabel('cal-p2-world', p2.world, d => `${Math.round(d.x)}, ${Math.round(d.y)}`);

    const p1Card = document.querySelector('.cal-point-card:nth-child(1)');
    const p2Card = document.querySelector('.cal-point-card:nth-child(2)');
    if (p1Card) p1Card.style.borderColor = activeCalPoint === 1 ? '#00f3ff' : 'rgba(255,255,255,0.1)';
    if (p2Card) p2Card.style.borderColor = activeCalPoint === 2 ? '#00f3ff' : 'rgba(255,255,255,0.1)';

    const doneBtn = document.getElementById('cal-done-btn');
    if (doneBtn) {
      const ready = p1.vision && p1.world && p2.vision && p2.world;
      doneBtn.disabled = !ready;
      doneBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
      doneBtn.style.background = ready ? '#3182f6' : '#1e40af';
      doneBtn.style.color = ready ? '#fff' : '#9ca3af';
    }
  }
}

// ─── 유틸리티 ──────────────────────────────────────────────────────
function setupWorkspaceTools() {
  window._mp1SelectTool = (toolName) => {
    currentTool = toolName;
    const selectBtn = document.getElementById('tool-select-btn');
    const pinBtn = document.getElementById('tool-pin-btn');
    const statusText = document.getElementById('tool-status-text');

    if (toolName === 'select') {
      if (selectBtn) { selectBtn.style.background = '#3182f6'; selectBtn.style.color = '#fff'; }
      if (pinBtn) { pinBtn.style.background = 'transparent'; pinBtn.style.color = '#b0b8c1'; }
      if (statusText) statusText.textContent = '마우스로 드래그하여 맵을 이동할 수 있습니다.';

      const vContainer = document.getElementById('map-viewport');
      if (vContainer) vContainer.style.cursor = 'grab';
    } else if (toolName === 'pin') {
      if (selectBtn) { selectBtn.style.background = 'transparent'; selectBtn.style.color = '#b0b8c1'; }
      if (pinBtn) { pinBtn.style.background = '#f59e0b'; pinBtn.style.color = '#1a1a2e'; }
      if (statusText) statusText.textContent = '클릭하여 기준점을 매핑하세요 (캘리브레이션 전용).';

      const vContainer = document.getElementById('map-viewport');
      if (vContainer) vContainer.style.cursor = 'crosshair';
    }
  };
}

function setupScreenShare() {
  window._mp1StartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
      const video = document.getElementById('game-screen-video');
      const standby = document.getElementById('vision-standby');
      if (video && standby) {
        video.srcObject = stream;
        video.style.display = 'block';
        standby.style.display = 'none';

        stream.getVideoTracks()[0].onended = () => {
          video.srcObject = null;
          video.style.display = 'none';
          standby.style.display = 'flex';
          window._mp1ScreenStream = null;
        };
        window._mp1ScreenStream = stream;
      }
    } catch (err) {
      console.warn('Screen share cancelled or failed', err);
    }
  };
}

function updateSensorUI(status, btnText) {
  const dot = document.getElementById('sensor-status-dot');
  const text = document.getElementById('sensor-status-text');
  const btn = document.getElementById('sensor-toggle-btn');

  const statusMap = {
    connected:    { color: '#22c55e', label: '연결됨 (WS)' },
    connecting:   { color: '#eab308', label: '연결 중...' },
    reconnecting: { color: '#f97316', label: '재연결 중...' },
    disconnected: { color: '#6b7280', label: '센서 대기 중' },
  };

  const s = statusMap[status] || statusMap.disconnected;
  if (dot) dot.style.background = s.color;
  if (text) text.textContent = s.label;
  if (btn && btnText) btn.textContent = btnText;
}

// ─── 시작 ───────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
