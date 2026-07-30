/**
 * main.js — MP1 시뮬레이터 앱 조립 진입점
 *
 * 역할: 센서 생성 → MapManager 초기화 → Renderer 연결 → UI 패널 연결
 * 기존 DOM UI(사냥터 선택, 스킬 배치 등)는 기존 inline script가 그대로 처리.
 * 이 파일은 Canvas 오버레이 레이어만 담당한다.
 *
 * @module main
 */
import { MockSensor } from '@sensors/MockSensor.js';
import { WebSocketSensor } from '@sensors/WebSocketSensor.js';
import { MapManager } from '@core/MapManager.js';
import { Renderer } from './canvas/Renderer.js';
import { VisionRenderer } from './canvas/VisionRenderer.js';
import regionsData from './data/regions.json';

// ─── 상태 ─────────────────────────────────────────────────────
let renderer = null;
let visionRenderer = null;
let mapManager = null;
let activeSensor = null;
let sensorRunning = false;
let sensorMode = 'mock'; // 'mock' | 'ws'
let currentTool = 'select'; // 'select' | 'pin'

// ─── 초기화 ────────────────────────────────────────────────────
function init() {
  mapManager = new MapManager(regionsData);
  
  mapManager.addEventListener('huntingGroundChanged', () => {
    if (renderer) renderer.onRegionChange();
  });

  hookLegacyMapEvents();
  setupSensorPanel();
  setupCalibrationPanel();
  setupWorkspaceTools();
  setupScreenShare();
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
    }
    
    renderer.onRegionChange();
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

    console.debug('[main] Canvas Renderer 시작:', hg.name);
  });

  window.addEventListener('mp1:mapExited', () => {
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

    updateSensorUI('disconnected', 'Mock 센서 켜기');
  });
}

// ─── 센서 패널 UI ───────────────────────────────────────────────
function setupSensorPanel() {
  // Mock/WS 모드 전환
  window._mp1SetSensorMode = (mode) => {
    if (sensorRunning && activeSensor) {
      activeSensor.stop();
      activeSensor = null;
      sensorRunning = false;
    }
    sensorMode = mode;
    const mockBtn = document.getElementById('sensor-mock-btn');
    const wsBtn = document.getElementById('sensor-ws-btn');
    if (mockBtn) mockBtn.classList.toggle('active', mode === 'mock');
    if (wsBtn) wsBtn.classList.toggle('active', mode === 'ws');
    updateSensorUI('disconnected',
      mode === 'ws' ? 'WS 연결' : 'Mock 센서 켜기'
    );
  };

  // 센서 토글 (Mock 또는 WS)
  window._mp1SensorToggle = () => {
    if (!renderer || !mapManager) return;

    if (sensorRunning && activeSensor) {
      activeSensor.stop();
      activeSensor = null;
      sensorRunning = false;
      updateSensorUI('disconnected',
        sensorMode === 'ws' ? 'WS 연결' : 'Mock 센서 켜기'
      );
      return;
    }

    if (sensorMode === 'ws') {
      activeSensor = new WebSocketSensor({ url: 'ws://localhost:8765' });
      activeSensor.onStatusChange((status) => {
        const labelMap = {
          connected: 'WS 연결 끊기',
          connecting: 'WS 연결 끊기',
          reconnecting: 'WS 연결 끊기',
          disconnected: 'WS 연결',
        };
        updateSensorUI(status, labelMap[status] || 'WS 연결');
      });
      activeSensor.onRegionChange((regionName) => {
        mapManager.setRegion(regionName);
      });
    } else {
      activeSensor = new MockSensor();
    }

    activeSensor.subscribe(pos => {
      window._lastRawVisionPos = { x: pos.x, y: pos.y };
      
      if (visionRenderer) {
        visionRenderer.onPosition(pos);
      }
      
      let finalPos = pos;
      if (mapManager && mapManager.calibration) {
        const cal = mapManager.calibration.apply(pos.x, pos.y);
        finalPos = { ...pos, x: cal.worldX, y: cal.worldY };
      }
      if (renderer) renderer.onPosition(finalPos);
    });
    activeSensor.start();
    sensorRunning = true;

    if (sensorMode === 'mock') {
      updateSensorUI('connected', 'Mock 센서 끄기');
    }
  };

  window._mp1TrailToggle = () => {
    if (!renderer) return;
    const layer = renderer.playerLayer;
    layer.showTrail = !layer.showTrail;
    const btn = document.getElementById('trail-toggle-btn');
    if (btn) btn.textContent = layer.showTrail ? '궤적 표시 ✓' : '궤적 숨기기';
  };
}

// ─── 캘리브레이션 UI 로직 ───────────────────────────────────────
function setupCalibrationPanel() {
  window._calData = {
    p1: { vision: null, world: null },
    p2: { vision: null, world: null },
  };

  window._mp1CalibrationStart = () => {
    const sp = document.getElementById('sensor-panel');
    const cp = document.getElementById('calibration-panel');
    if (sp) sp.style.display = 'none';
    if (cp) cp.style.display = 'flex';

    window._isCalibrationMode = true;
    window._calData.p1 = { vision: null, world: null };
    window._calData.p2 = { vision: null, world: null };
    
    updateCalUI();
    window._mp1SelectTool('pin'); // 캘리브레이션 진입 시 핀 도구 활성화

    const trackerCanvas = document.getElementById('tracker-canvas');
    const visionCanvas = document.getElementById('vision-overlay-canvas');
    if (trackerCanvas) {
      trackerCanvas.style.cursor = 'crosshair';
      trackerCanvas.addEventListener('click', onTrackerCanvasClick);
    }
    if (visionCanvas) {
      visionCanvas.style.cursor = 'crosshair';
      visionCanvas.addEventListener('click', onVisionCanvasClick);
    }
  };

  const onVisionCanvasClick = (e) => {
    if (!window._isCalibrationMode || currentTool !== 'pin') return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    // 비전 캔버스는 가상 해상도 (e.g. 1366x768)로 매핑
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const vx = (e.clientX - rect.left) * scaleX;
    const vy = (e.clientY - rect.top) * scaleY;
    
    if (!window._calData.p1.vision) {
      window._calData.p1.vision = { x: vx, y: vy };
    } else if (!window._calData.p2.vision) {
      window._calData.p2.vision = { x: vx, y: vy };
    } else {
      window._calData.p2.vision = { x: vx, y: vy };
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

    if (!window._calData.p1.world) {
      window._calData.p1.world = worldPos;
    } else if (!window._calData.p2.world) {
      window._calData.p2.world = worldPos;
    } else {
      window._calData.p2.world = worldPos;
    }
    updateCalUI();
  };

  window._mp1CalibrationCapture = (step) => {
    if (!window._lastRawVisionPos) {
      alert('센서에서 좌표를 수신받지 못했습니다.');
      return;
    }
    const { x, y } = window._lastRawVisionPos;
    if (step === 1) {
      window._calData.p1.vision = { x, y };
    } else {
      window._calData.p2.vision = { x, y };
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
        alert('캘리브레이션이 완료되었습니다.');
      }
    }
    closeCalibrationPanel();
    window._mp1SelectTool('select');
  };

  function closeCalibrationPanel() {
    window._isCalibrationMode = false;
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
    connected:    { color: '#22c55e', label: sensorMode === 'ws' ? '연결됨 (WS)' : '연결됨 (Mock)' },
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
