# 모노레포 최상위 운영지침 (Monorepo Operational Guidelines)

## 📌 UI/UX 아키텍처 원칙 (UI/UX Architecture Directive)

> **핵심 지침**: 이 모노레포의 모든 웹 프론트엔드 UI 및 프레젠테이션 레이어는 **HTML5 인터랙티브 HUD UI (Hoyoverse HTML5 Game Web App Style)** 기반으로 구현하고 확장한다.

---

### 1. HTML5 인터랙티브 HUD UI 설계 표준

1. **풀스크린 뷰포트 (Full-bleed Interactive Viewport)**
   * 복잡하고 답답한 전통적 윈도우 그리드/도킹 프레임워크(Golden Layout 등) 대신 **HTML5 Canvas / WebGL 뷰포트를 화면 최우선(Full-screen)으로 배치**한다.
   * 사용자에게 몰입감 있는 게임 에디터 및 웹 앱 경험을 제공한다.

2. **플로팅 글래스모피즘 HUD (Floating Glassmorphism Overlay HUD)**
   * 조작 도구, 센서 컨트롤, PIP 비전 모니터, 스킬바 등 모든 기능 패널은 캔버스 위에 부유하는 **반투명 글래스모피즘 HUD (ackdrop-filter: blur(12px)) 형태**로 배치한다.
   * 각 HUD 패널은 최소화(Minimize)/확장(Expand)이 자유로워야 하며 메인 캔버스 뷰를 방해하지 않아야 한다.

3. **시각적 완성도 및 네온/플루이드 인터랙션**
   * 호요버스(원신/스타레일) AAA급 HTML5 웹 이벤트/UGC 웹 앱 특유의 **네온 Glow 효과, 미형 라운드 패널, 부드러운 트랜지션 애니메이션**을 필수로 준수한다.
   * 반응형 포커스 및 디바이스 환경에 구애받지 않는 고해상도(Retina scaling) Canvas 렌더링을 보장한다.

---

### 2. 코드베이스 반영 규칙

* **Web UI 마이그레이션**: pps/web/ 내의 모든 인터페이스는 본 지침의 글래스 HUD 시스템을 준수한다.
* **디자인 토큰 통합**: packages/design-tokens는 글래스 HUD 규격에 맞는 반투명 아크릴 투명도, 네온 강조색, 폰트 스케일을 제공한다.
* **추후 신규 앱/패키지 추가 시**: 본 모노레포 내 생성되는 모든 시각적 웹 컴포넌트는 해당 HTML5 HUD 패러다임을 통일되게 계승한다.
