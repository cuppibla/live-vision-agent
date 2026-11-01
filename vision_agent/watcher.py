"""EP6 · advanced pattern: a separate vision model as a *watcher*.

The live agent keeps the conversation. The watcher looks at frames for one
specific thing (a hazard, a gesture, a state change) and only speaks up when
it sees it. The main agent never has to carry every frame itself.
"""

import asyncio
import json
import os
import re
from typing import Callable, Awaitable, Optional

from google import genai
from google.genai import types

WATCHER_MODEL = os.environ.get("WATCHER_MODEL", "gemini-2.5-flash")

PROMPT = """You are a silent watcher looking at one camera frame.
Target: "{target}".
Reply with JSON only: {{"seen": true|false, "note": "<= 8 words"}}.
"seen" is true only if the target is clearly visible in this frame."""

_JSON = re.compile(r"\{.*\}", re.S)


class Watcher:
    def __init__(self, on_result: Callable[[dict], Awaitable[None]]):
        self._client = genai.Client()
        self._on_result = on_result
        self.target: Optional[str] = None
        self._busy = False
        self._last_seen = False

    def set_target(self, target: Optional[str]) -> None:
        self.target = (target or "").strip() or None
        self._last_seen = False

    async def offer(self, jpeg: bytes) -> None:
        """Offer a frame. Frames arriving while a call is in flight are dropped."""
        if not self.target or self._busy:
            return
        self._busy = True
        try:
            resp = await self._client.aio.models.generate_content(
                model=WATCHER_MODEL,
                contents=[
                    types.Part.from_bytes(data=jpeg, mime_type="image/jpeg"),
                    PROMPT.format(target=self.target),
                ],
                config=types.GenerateContentConfig(temperature=0.0),
            )
            m = _JSON.search(resp.text or "")
            data = json.loads(m.group(0)) if m else {"seen": False, "note": ""}
            seen = bool(data.get("seen"))
            result = {
                "seen": seen,
                "note": str(data.get("note", ""))[:60],
                "rising_edge": seen and not self._last_seen,
            }
            self._last_seen = seen
            await self._on_result(result)
        except Exception as e:  # keep the watcher from killing the session
            await self._on_result({"seen": False, "note": "", "error": str(e)[:120]})
        finally:
            self._busy = False
