import { GoldenLayout } from 'golden-layout';
import 'golden-layout/dist/css/goldenlayout-base.css';
import 'golden-layout/dist/css/themes/goldenlayout-dark-theme.css';

let layout = null;

export function initLayout() {
  const container = document.getElementById('gl-container');
  if (!container) return;

  layout = new GoldenLayout(container);

  // 컴포넌트 등록: 기존 DOM 요소를 가져와서 컨테이너에 붙입니다.
  const registerDOM = (name, id) => {
    layout.registerComponentFactoryFunction(name, (container, componentState) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = el.dataset.display || 'flex';
        container.element.appendChild(el);
      }
    });
  };

  registerDOM('VisionMonitor', 'vision-viewport');
  registerDOM('MapWorkspace', 'map-viewport-wrapper');
  registerDOM('Controls', 'mp1-controls-wrapper');
  registerDOM('Skills', 'skill-sidebar-content');

  // 레이아웃 환경 설정
  const config = {
    settings: {
      showPopoutIcon: false, // 팝아웃(새 창 띄우기) 비활성화 (캔버스 컨텍스트 문제 방지)
    },
    root: {
      type: 'row',
      content: [
        {
          type: 'column',
          width: 75,
          content: [
            {
              type: 'component',
              componentType: 'VisionMonitor',
              title: '실시간 비전 모니터',
              height: 45
            },
            {
              type: 'component',
              componentType: 'MapWorkspace',
              title: '맵핑 작업 공간',
              height: 55
            }
          ]
        },
        {
          type: 'column',
          width: 25,
          content: [
            {
              type: 'component',
              componentType: 'Controls',
              title: '센서 & 캘리브레이션',
              height: 50
            },
            {
              type: 'component',
              componentType: 'Skills',
              title: '스킬 및 이벤트',
              height: 50
            }
          ]
        }
      ]
    }
  };

  // 기존 저장된 레이아웃이 있다면 불러오기 (TODO)
  layout.loadLayout(config);

  // 창 크기 조절 시 레이아웃 리사이즈
  window.addEventListener('resize', () => {
    layout.updateSize();
  });
}
