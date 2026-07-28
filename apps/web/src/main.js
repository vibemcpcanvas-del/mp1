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

// ─── 초기화 ────────────────────────────────────────────────────
function init() {
  // MapManager 생성
  mapManager = new MapManager(regionsData);

  // 사냥터 진입 시 호출되는 기존 함수에 후킹
  // 기존 enterMap()이 activeMapData를 설정한 뒤 window 이벤트를 발행하도록 연결
  hookLegacyMapEvents();

  // UI 패널 버튼 연결
  setupSensorPanel();
}

/**
 * 기존 inline script의 enterMap/goBack 함수에 Canvas 오버레이 연동을 위한 후킹
 * 기존 함수를 덮어쓰지 않고, CustomEvent 방식으로 연결한다.
 */
function hookLegacyMapEvents() {
  // 기존 inline script에서 enterMap() 호출 시
  // window.dispatchEvent(new CustomEvent('mp1:mapEntered', { detail: { mapData } }))를 발행해야 함.
  // 이를 위해 기존 enterMap 함수를 래핑한다.
  const pollForLegacy = setInterval(() => {
    if (typeof window.enterMap === 'function' && typeof window.goBack === 'function') {
      clearInterval(pollForLegacy);

      const origEnterMap = window.enterMap;
      window.enterMap = function(huntingGround) {
        origEnterMap.apply(this, arguments);
        // Canvas에 현재 사냥터 데이터 전달
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

  // 맵 진입 이벤트 → Renderer 시작
  window.addEventListener('mp1:mapEntered', (e) => {
    const canvas = document.getElementById('tracker-canvas');
    if (!canvas) return;

    const hg = e.detail.huntingGround;
    if (!hg) return;

    // 현재 지역에 맞게 MapManager 갱신
    // activeMapData.regionName은 기존 코드의 currentRegionName을 참조
    const regionName = window.currentRegionName;
    if (regionName) {
      mapManager.setRegion(regionName);
    }
    mapManager.setHuntingGround(hg);

    // Renderer 초기화 또는 갱신
    if (!renderer) {
      renderer = new Renderer(canvas, mapManager);
    }
    renderer.onRegionChange();
    renderer.start();

    // 센서 패널 표시
    const panel = document.getElementById('sensor-panel');
    if (panel) panel.style.display = 'flex';

    // 사냥터 진입 시 활성 센서 재연결
    if (activeSensor && sensorRunning) {
      activeSensor.stop();
      activeSensor.start();
    }

    console.debug('[main] Canvas Renderer 시작:', hg.name);
  });

  // 맵 종료 이벤트 → Renderer 정지
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
  // 전역 콜백 등록 (HTML onclick에서 호출)
  window._mp1SensorToggle = () => {
    if (!renderer || !mapManager) return;

    if (sensorRunning && activeSensor) {
      // 정지
      activeSensor.stop();
      activeSensor = null;
      sensorRunning = false;
      updateSensorUI('disconnected', 'Mock 센서 켜기');
    } else {
      // MockSensor 시작
      activeSensor = new MockSensor();
      activeSensor.subscribe(pos => {
        if (renderer) renderer.onPosition(pos);
      });
      activeSensor.start();
      sensorRunning = true;
      updateSensorUI('connected', 'Mock 센서 끄기');
    }
  };

  window._mp1TrailToggle = () => {
    if (!renderer) return;
    const layer = renderer.playerLayer;
    layer.showTrail = !layer.showTrail;

    const btn = document.getElementById('trail-toggle-btn');
    if (btn) {
      btn.textContent = layer.showTrail ? '궤적 표시 ✓' : '궤적 숨기기';
    }
  };

  // WebSocketSensor 연결 (향후 확장용 — 현재는 주석)
  // window._mp1ConnectWS = () => {
  //   activeSensor = new WebSocketSensor({ url: 'ws://localhost:8765' });
  //   activeSensor.onStatusChange(status => updateSensorUI(status, ...));
  //   activeSensor.subscribe(pos => renderer && renderer.onPosition(pos));
  //   activeSensor.start();
  // };
}

function updateSensorUI(status, btnText) {
  const dot = document.getElementById('sensor-status-dot');
  const text = document.getElementById('sensor-status-text');
  const btn = document.getElementById('sensor-toggle-btn');

  const statusMap = {
    connected:    { color: '#22c55e', label: '연결됨 (Mock)' },
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
// DOM 로드 후 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
