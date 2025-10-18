import os
import json
import asyncio
import websockets
from urllib.parse import urlparse
from typing import Callable, Optional

SM_URL = os.getenv("SPEECHMATICS_URL", "wss://eu1.rt.speechmatics.com/v2").strip()
SM_LANG = os.getenv("SPEECHMATICS_LANG", "cs")
SM_SR   = int(os.getenv("SPEECHMATICS_SR", "48000"))

def _extract_text(data: dict) -> str:
    try:
        results = data.get("results") or []
        parts = []
        for r in results:
            alts = r.get("alternatives") or []
            if alts:
                txt = alts[0].get("content") or ""
                if txt:
                    parts.append(txt)
        return " ".join(parts).strip()
    except Exception:
        return ""

class SpeechmaticsStream:
    """
    Realtime WS:
      - Authorization: Bearer <API_KEY> (HTTP header)
      - message: 'StartRecognition' (TEXT JSON)
      - audio chunks: BINARY PCM16LE
      - finish: message: 'EndOfStream', last_seq_no: <int>
    """

    def __init__(
        self,
        on_partial: Callable[[str], None],
        on_final: Callable[[str], None],
        on_event: Optional[Callable[[dict], None]] = None,
    ):
        self.on_partial = on_partial
        self.on_final = on_final
        self.on_event = on_event
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.reader_task: Optional[asyncio.Task] = None
        self._closed = False
        self._last_seq_no = 0  # z "AudioAdded"

    async def start(self):
        api_key = os.getenv("SPEECHMATICS_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("SPEECHMATICS_API_KEY není v .env")

        base = os.getenv("SPEECHMATICS_URL", "wss://eu1.rt.speechmatics.com/v2").strip()
        p = urlparse(base)
        if not p.scheme.startswith("ws") or not p.netloc:
            raise RuntimeError(
                f"Neplatné SPEECHMATICS_URL: {base!r}. "
                f"Použij např. 'wss://eu1.rt.speechmatics.com/v2'"
            )

        # Připojení s Authorization headerem (dlouhodobý klíč z portálu)
        self.ws = await websockets.connect(
            base,
            extra_headers=[("Authorization", f"Bearer {api_key}")],
            write_limit=2**22,
            max_size=2**22,
        )

        start_msg = {
            "message": "StartRecognition",
            "audio_format": {
                "type": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": SM_SR,
                #"channels": 1,
            },
            "transcription_config": {
                "language": SM_LANG,
                "enable_partials": True,
                "operating_point": "enhanced",
                "max_delay": 2.0
            },
        }
        await self.ws.send(json.dumps(start_msg))
        self.reader_task = asyncio.create_task(self._reader())

    async def _reader(self):
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                except Exception:
                    continue

                # volitelný hook pro logování do UI
                if self.on_event:
                    try:
                        await self.on_event(data)
                    except Exception:
                        pass

                msg = (data.get("message") or "").lower()

                if msg == "audioadded":
                    try:
                        self._last_seq_no = int(data.get("seq_no") or self._last_seq_no)
                    except Exception:
                        pass

                elif msg == "addpartialtranscript":
                    text = _extract_text(data)
                    if text:
                        await self.on_partial(text)

                elif msg == "addtranscript":
                    text = _extract_text(data)
                    if text:
                        await self.on_final(text)

        except websockets.ConnectionClosed:
            self._closed = True

    async def feed(self, pcm_bytes: bytes):
        if self.ws and not self._closed:
            await self.ws.send(pcm_bytes)  # BINARY frame

    async def finish(self):
        try:
            if self.ws and not self._closed:
                eos = {"message": "EndOfStream", "last_seq_no": int(self._last_seq_no)}
                await self.ws.send(json.dumps(eos))
        except Exception:
            pass

        if self.reader_task:
            try:
                await asyncio.wait_for(self.reader_task, timeout=4)
            except asyncio.TimeoutError:
                pass

        if self.ws and not self._closed:
            await self.ws.close()
            self._closed = True

    async def close(self):
        await self.finish()
