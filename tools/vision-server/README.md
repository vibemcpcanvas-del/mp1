# Vision Server

미니맵 색상 추출 기반 캐릭터 위치 추적 서버.

## 동작 방식

1. `mss`로 화면의 미니맵 영역을 캡처
2. OpenCV HSV 색상 필터로 캐릭터 점(노란색) 검출
3. 좌표를 WebSocket으로 브라우저에 송신

## 설치

```bash
cd tools/vision-server
pip install -r requirements.txt
```

## 실행

```bash
python server.py
```

기본 포트: `ws://localhost:8765`

## 미니맵 영역 설정

`config.py`의 `MINIMAP_REGION`을 실제 게임 미니맵 위치에 맞게 수정하세요.

```python
MINIMAP_REGION = {
    "top": 10,    # 화면 상단에서 픽셀
    "left": 10,   # 화면 좌측에서 픽셀
    "width": 150,
    "height": 150
}
```

## 메시지 포맷

```json
{
  "x": 0.5,
  "y": 0.3,
  "confidence": 0.85,
  "region": "current"
}
```

- `x`, `y`: 미니맵 내 정규화 좌표 (0~1)
- `confidence`: 검출 신뢰도 (0~1)
- `region`: 현재는 고정값 `"current"`
