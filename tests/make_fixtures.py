"""Build fake-camera + fake-mic fixtures for the end-to-end test.

  python tests/make_fixtures.py

Writes tests/fixtures/camera.y4m (20 s, 4 moving scenes) and
tests/fixtures/mic.wav ("What is this? …" then silence). Needs ffmpeg,
Pillow and GOOGLE_API_KEY (for Gemini TTS).
"""
import math, os, subprocess, wave, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "fixtures"; OUT.mkdir(exist_ok=True)
W, H, FPS, SEC = 640, 480, 8, 20
font = ImageFont.load_default(size=40)

def frame(t):
    im = Image.new("RGB", (W, H), (236, 232, 224)); d = ImageDraw.Draw(im)
    d.rectangle((0, 340, W, H), fill=(150, 110, 70))
    if t < 5:   # apple
        d.ellipse((230, 150, 410, 330), fill=(200, 30, 40)); d.rectangle((315, 120, 325, 160), fill=(80, 50, 20))
        d.text((200, 30), "HELLO EP6", fill=(20, 20, 20), font=font)
    elif t < 10:  # banana sliding
        x = int(-200 + (t - 5) / 5 * 900)
        d.chord((x, 180, x + 260, 330), 200, 340, fill=(240, 210, 40)); d.text((230, 30), "BANANA", fill=(20, 20, 20), font=font)
    elif t < 15:  # hand rising
        y = int(520 - (t - 10) / 5 * 300)
        d.rounded_rectangle((250, y, 390, y + 170), 40, fill=(222, 180, 150))
        for k, fx in enumerate([262, 290, 318, 346, 374]):
            fl = 110 if k not in (0, 4) else 80
            d.rounded_rectangle((fx, y - fl, fx + 22, y + 20), 11, fill=(222, 180, 150))
        d.text((190, 30), "HAND UP", fill=(20, 20, 20), font=font)
    else:  # stop sign
        cx, cy, r = 320, 220, 120
        pts = [(cx + r * math.cos(math.radians(22.5 + 45 * k)), cy + r * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]
        d.polygon(pts, fill=(200, 20, 30), outline=(255, 255, 255), width=8)
        d.text((255, 200), "STOP", fill=(255, 255, 255), font=font)
    return im

with tempfile.TemporaryDirectory() as tmp:
    for i in range(FPS * SEC):
        frame(i / FPS).save(f"{tmp}/f{i:04d}.png")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{tmp}/f%04d.png",
                    "-pix_fmt", "yuv420p", str(OUT / "camera.y4m")], check=True)
print("camera.y4m ok")

from google import genai
from google.genai import types
text = "What is this? Please read any text you see."
r = genai.Client().models.generate_content(
    model="gemini-2.5-flash-preview-tts", contents=f"Say in a natural voice: {text}",
    config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")))))
pcm = r.candidates[0].content.parts[0].inline_data.data; rate = 24000
with wave.open(str(OUT / "mic.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(b"\x00\x00" * rate * 3 + pcm + b"\x00\x00" * rate * 25)
print("mic.wav ok")
