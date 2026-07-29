import cv2
import numpy as np
import mss
from config import MINIMAP_REGION, CHAR_COLOR_LOWER, CHAR_COLOR_UPPER


class MinimapTracker:
    """미니맵에서 캐릭터 위치를 색상 기반으로 추출"""

    def __init__(self):
        self.sct = mss.mss()
        self.region = MINIMAP_REGION
        self.lower = np.array(CHAR_COLOR_LOWER, dtype=np.uint8)
        self.upper = np.array(CHAR_COLOR_UPPER, dtype=np.uint8)

    def capture(self):
        screenshot = self.sct.grab(self.region)
        frame = np.array(screenshot)
        return cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

    def find_character(self):
        """
        미니맵에서 캐릭터 점 좌표 추출
        반환값: {x, y, confidence} 또는 None
        """
        frame = self.capture()
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, self.lower, self.upper)

        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area < 1:
            return None

        M = cv2.moments(largest)
        if M["m00"] == 0:
            return None

        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])

        h, w = frame.shape[:2]
        confidence = min(1.0, area / (h * w) * 1000)

        return {
            "x": cx / w,
            "y": cy / h,
            "confidence": round(confidence, 3)
        }
