import asyncio
import json
import websockets
from minimap_tracker import MinimapTracker
from config import WS_HOST, WS_PORT, SEND_INTERVAL


tracker = MinimapTracker()
clients = set()


async def handler(websocket):
    clients.add(websocket)
    print(f"[연결] 클라이언트 접속: {websocket.remote_address}")
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)
        print(f"[해제] 클라이언트 접속 종료")


async def broadcast_loop():
    while True:
        if clients:
            result = tracker.find_character()
            if result:
                payload = json.dumps({
                    "x": result["x"],
                    "y": result["y"],
                    "confidence": result["confidence"],
                    "region": "current"
                })
                dead = set()
                for ws in clients.copy():
                    try:
                        await ws.send(payload)
                    except Exception:
                        dead.add(ws)
                clients -= dead
        await asyncio.sleep(SEND_INTERVAL)


async def main():
    print(f"[시작] Vision Server ws://{WS_HOST}:{WS_PORT}")
    async with websockets.serve(handler, WS_HOST, WS_PORT):
        await broadcast_loop()


if __name__ == "__main__":
    asyncio.run(main())
