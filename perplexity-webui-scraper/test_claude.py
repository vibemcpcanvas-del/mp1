from openai import OpenAI
import json, sys

client = OpenAI(base_url="http://127.0.0.1:8000/v1", api_key="eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..nRnzs0D11GTJANo5.fmZ_Ikpt3Fc7gCSjaWOUCrrlMirG3BSJv8Mllwjj3rnGQTN9tF70w9XFpi-JU2padSJLEfPZJoNNbmmh6CzwpuqVDognQtjxX3qKPdFKNDG-jDb58Ld0Knl96Z3D9Jm8G1_clU9DaaJ-nxZJ136OFR52vJqc6IDa7Ei-Z14e3iVNh0jWWg7zD0KONM6jLBXE98lduwuBM32OcG0ODnw3WnG_-43z6RGJLOZ7aL_wWEjnFdWSLF6RC0Kak_hPI0mJHtI9PsfFrXWjsGHgUF8q8Pb6nigKwj4.xmL0tFZiPH7YD4bzIzD9TA")
resp = client.chat.completions.create(model="anthropic/claude-sonnet-5-thinking", messages=[{"role": "user", "content": "초코칩나라는 어디에 있는지 심층 분석 해줘."}])
print(json.dumps(resp, default=str, ensure_ascii=False, indent=2))
