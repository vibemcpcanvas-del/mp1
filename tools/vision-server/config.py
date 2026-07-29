# Vision Server 설정
WS_HOST = "localhost"
WS_PORT = 8765

# 미니맵 영역 (픽셀 좌표: 기본값, 실행 중 자동 보정 가능)
MINIMAP_REGION = {
    "top": 10,
    "left": 10,
    "width": 150,
    "height": 150
}

# 캐릭터 점 색상 범위 (HSV)
# 메이플스토리 미니맵 캐릭터 점: 노란색 계열
CHAR_COLOR_LOWER = [20, 100, 100]
CHAR_COLOR_UPPER = [35, 255, 255]

# 송신 주기 (초)
SEND_INTERVAL = 0.05  # 20fps
