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
import regionsData from './data/regions.json';

// ─── 상태 ─────────────────────────────────────────────────────
let renderer = null;
let mapManager = null;
let activeSensor = null;
let sensorRunning = false;
let sensorMode = 'mock'; // 'mock' | 'ws'

// ─── 초기화 ────────────────────────────────────────────────────
function init() {
  mapManager = new MapManager(regionsData);
  hookLegacyMapEvents();
  setupSensorPanel();
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
    renderer.onRegionChange();
    renderer.start();

    const panel = document.getElementById('sensor-panel');
    if (panel) panel.style.display = 'flex';

    if (activeSensor && sensorRunning) {
      activeSensor.stop();
      activeSensor.start();
    }

    console.debug('[main] Canvas Renderer 시작:', hg.name);
  });

  window.addEventListener('mp1:mapExited', () => {
    if (renderer) {
      renderer.stop();
      renderer = null;
    }
    if (activeSensor) {
      activeSensor.stop();
      sensorRunning = false;
    }
    const panel = document.getElementById('sensor-panel');
    if (panel) panel.style.display = 'none';

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
    } else {
      activeSensor = new MockSensor();
    }

    activeSensor.subscribe(pos => {
      if (renderer) renderer.onPosition(pos);
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
