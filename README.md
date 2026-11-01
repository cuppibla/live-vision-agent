# Eyes · EP6 — Give your AI agent eyes

A minimal **ADK + Gemini Live** demo: one live session that hears your voice
*and* sees your camera.

```
camera → canvas → JPEG → Blob → model
mic    → PCM           → Blob → model
```

Same session. Same model. Different kinds of input.

## What the UI shows

| Button | Pattern | When |
|---|---|---|
| **Look** (or `Space`) | snapshot — one deliberate frame | the scene is static: an outfit, a document, a label |
| **Watch** | stream — frames at ½ / 1 / 2 fps | the world changes on its own |
| **Watcher** | a *separate* vision model scans frames for one thing and only speaks up when it sees it | hazards, gestures, state changes |

The pipeline strip lights up `Camera → Canvas → JPEG → Blob → Model` every
time a frame is sent, and the stat pill counts frames, bytes and tokens.
Frames are not free.

## Run

```bash
cp .env.example .env        # add your GOOGLE_API_KEY
pip install -r requirements.txt
python main.py
```

Open <http://localhost:8000>, tap the mic, hold something up and ask
*“what is this?”*

> Camera and mic need a secure context. `localhost` is fine. To demo from a
> phone, tunnel with `ngrok http 8000` (or similar) and open the https URL.

## Files

```
main.py                  FastAPI + WebSocket bridge  ⇄  ADK run_live
vision_agent/agent.py    the agent (nothing vision-specific here)
vision_agent/watcher.py  advanced pattern: separate vision model as a watcher
static/app.js            camera → canvas → JPEG → Blob, snapshot vs stream
static/pcm-recorder.js   mic → 16 kHz PCM16
static/pcm-player.js     24 kHz PCM16 → speakers
```

## The one idea

An image is just bytes + a mime type — a `Blob`. The live request queue that
takes audio takes images too:

```python
queue.send_realtime(types.Blob(data=jpeg_bytes, mime_type="image/jpeg"))
```

Snapshot when the agent needs to **look**. Stream when it needs to **watch**.
If the voice session starts to feel unstable, you are sending too many frames.
