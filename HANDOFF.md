# Handoff & Project Status

## 1. 완료된 작업 (Completed Tasks)
- **AI Proxy 우회 및 고정 (`perplexity-webui-scraper`)**
  - `completions.py`: 모델을 `anthropic/claude-sonnet-5-thinking`으로 강제 할당하도록 수정.
  - `account.py`: 무료 티어 등급 검사에서 발생하는 `ModelAccessError`를 우회하도록 처리.
- **메이플 캔버스 오류 수정 (`apps/web/index.html`)**
  - 이전 커밋에서 센서 패널 주입 중 실수로 삭제되었던 4,400여 줄의 인라인 자바스크립트(사냥터/직업/스킬 데이터 및 UI 연동 로직)를 완벽히 복구.
  - 사냥터 진입 버튼, 직업 스킬 선택 버튼 등 UI 정상화 확인.
- **모노레포 Git 환경 구축**
  - 루트 `.gitignore` 생성 및 모노레포 구조를 Github `mp1` 저장소의 `main` 브랜치에 연동 및 푸시 완료.
  - `apps/web`은 기존 `.github/workflows/pages.yml`에 의해 자동으로 Github Pages 배포 연동됨.

## 2. 향후 과제 및 고민 포인트 (Next Steps & To-Dos)
- **AI Proxy CI/CD 및 아키텍처 고민**
  - 프록시 서버(`perplexity-webui-scraper`)를 Github Actions 등을 이용해 CI/CD로 띄울지 논의함.
  - 당장 구축하기보다는 모노레포 아키텍처 관점에서 프록시가 **"인공지능 모델(Model) 영역을 전담하는 백엔드 마이크로서비스"**로서 어떤 구조를 가져야 할지 좀 더 구체화(고민)한 후 진행하기로 홀드(Hold)됨.
  - 향후 확정 시 해당 프록시를 클라우드나 터널링 방식 등으로 띄워 웹 프론트엔드(`apps/web`)와 연동할 수 있도록 설계 필요.

## 3. 구조 요약 (Repository Structure)
- `/apps/web/`: 메이플스토리 사냥터 배치 시뮬레이터 (프론트엔드 UI, Github Pages 자동 배포)
- `/perplexity-webui-scraper/`: Claude/Perplexity 스크래핑을 통한 AI 프록시 API (현재 모델 강제 할당 및 우회 로직 적용됨)
