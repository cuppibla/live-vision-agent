"""EP6 · Give your agent eyes.

Browser  --websocket-->  this server  --LiveRequestQueue-->  ADK agent (Gemini Live)

Audio chunks and image frames travel the SAME path:

    camera -> canvas -> JPEG -> Blob -> model
    mic    ->  PCM   ->      -> Blob -> model
"""

import asyncio
import base64
import json
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from google.adk.agents import LiveRequestQueue  # noqa: E402
from google.adk.agents.run_config import RunConfig, StreamingMode  # noqa: E402
from google.adk.runners import InMemoryRunner  # noqa: E402
from google.genai import types  # noqa: E402

from vision_agent import root_agent  # noqa: E402
from vision_agent.watcher import Watcher  # noqa: E402

APP_NAME = "live-vision-agent"
STATIC = Path(__file__).parent / "static"

app = FastAPI()
app.mount("/static", StaticFiles(directory=STATIC), name="static")
runner = InMemoryRunner(agent=root_agent, app_name=APP_NAME)


@app.get("/")
async def index():
    return FileResponse(STATIC / "index.html")


def run_config() -> RunConfig:
    return RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    user_id = f"user-{uuid.uuid4().hex[:6]}"
    session = await runner.session_service.create_session(
        app_name=APP_NAME, user_id=user_id
    )
    queue = LiveRequestQueue()
    send_lock = asyncio.Lock()

    async def send(msg: dict) -> None:
        async with send_lock:
            await ws.send_text(json.dumps(msg))

    # ---- advanced pattern: separate vision model as a watcher --------------
    async def on_watch(result: dict) -> None:
        await send({"type": "watch", **result})
        if result.get("rising_edge"):
            # Hand the finding to the talking agent as plain text.
            queue.send_content(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(
                        text=f"[watcher] I just spotted: {result['note'] or 'the target'}."
                    )],
                )
            )

    watcher = Watcher(on_watch)

    # ---- browser -> model --------------------------------------------------
    async def upstream() -> None:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            t = msg.get("type")

            if t == "audio":
                pcm = base64.b64decode(msg["data"])
                queue.send_realtime(types.Blob(data=pcm, mime_type="audio/pcm;rate=16000"))

            elif t == "frame":
                # The whole point of the episode: an image is just bytes + a mime type.
                jpeg = base64.b64decode(msg["data"])
                queue.send_realtime(types.Blob(data=jpeg, mime_type="image/jpeg"))
                await send({"type": "frame_ack", "bytes": len(jpeg), "mode": msg.get("mode")})
                if msg.get("watch"):
                    asyncio.create_task(watcher.offer(jpeg))

            elif t == "text":
                queue.send_content(
                    types.Content(role="user", parts=[types.Part.from_text(text=msg["text"])])
                )

            elif t == "watch":
                watcher.set_target(msg.get("target"))
                await send({"type": "watch_target", "target": watcher.target})

    # ---- model -> browser --------------------------------------------------
    async def downstream() -> None:
        async for event in runner.run_live(
            user_id=user_id,
            session_id=session.id,
            live_request_queue=queue,
            run_config=run_config(),
        ):
            if event.input_transcription and event.input_transcription.text:
                await send({
                    "type": "transcript", "role": "user",
                    "text": event.input_transcription.text,
                    "final": bool(event.input_transcription.finished),
                })
            if event.output_transcription and event.output_transcription.text:
                await send({
                    "type": "transcript", "role": "agent",
                    "text": event.output_transcription.text,
                    "final": bool(event.output_transcription.finished),
                })
            if event.content and event.content.parts:
                for part in event.content.parts:
                    blob = part.inline_data
                    if blob and blob.data and blob.mime_type.startswith("audio/pcm"):
                        await send({"type": "audio", "data": base64.b64encode(blob.data).decode()})
            if event.interrupted:
                await send({"type": "interrupted"})
            if event.turn_complete:
                await send({"type": "turn_complete"})
            if event.usage_metadata and event.usage_metadata.total_token_count:
                await send({"type": "usage", "total": event.usage_metadata.total_token_count})
            if event.error_message:
                await send({"type": "error", "message": event.error_message})

    up = asyncio.create_task(upstream())
    down = asyncio.create_task(downstream())
    try:
        done, pending = await asyncio.wait({up, down}, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            exc = task.exception()
            if exc and not isinstance(exc, WebSocketDisconnect):
                try:
                    await send({"type": "error", "message": f"{type(exc).__name__}: {exc}"[:300]})
                except Exception:
                    pass
    finally:
        queue.close()
        for task in (up, down):
            task.cancel()
        await asyncio.gather(up, down, return_exceptions=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
