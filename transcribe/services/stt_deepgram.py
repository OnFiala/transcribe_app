import asyncio
import json
import os
import websockets

# Parametry streamu: PCM (linear16), 16 kHz, mono, čeština
DG_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-2-general"  # ← přidej model
    "&encoding=linear16&sample_rate=16000&channels=1"
    "&language=cs&smart_format=true&punctuate=true&interim_results=true"
)


class DeepgramStream:
    """
    Otevře WebSocket k Deepgramu, přijímá PCM16 chunky (bytes) a čte partial/final výsledky.
    on_partial a on_final jsou async callbacky (func: str -> await None).
    """
    def __init__(self, on_partial, on_final):
        self.on_partial = on_partial
        self.on_final = on_final
        self.ws = None
        self.reader_task = None

    async def start(self):
        api_key = os.environ.get("DEEPGRAM_API_KEY", "")
        if not api_key:
            raise RuntimeError("DEEPGRAM_API_KEY není nastaven (viz .env).")

        headers = [("Authorization", f"Token {api_key}")]
        # Pozn.: write_limit/max_size zvětšujeme kvůli plynulejšímu streamu
        subprotocols = [f"token, {api_key}"]
        self.ws = await websockets.connect(
            DG_URL,
            extra_headers=headers,
            write_limit=2**22,
            max_size=2**22,
        )
        # paralelní čtení zpráv z Deepgramu
        self.reader_task = asyncio.create_task(self._reader())

    async def _reader(self):
        try:
            async for message in self.ws:
                # Deepgram posílá JSON eventy s transcriptem
                try:
                    data = json.loads(message)
                except Exception:
                    continue

                transcript = None
                is_final = False

                # typická struktura odpovědi (v1): { type, channel: { alternatives: [{transcript: "..."}] }, is_final }
                if data.get("type") == "transcript":
                    alts = data.get("channel", {}).get("alternatives", [])
                    if alts:
                        transcript = alts[0].get("transcript", "")
                    is_final = data.get("is_final", False)
                elif "channel" in data:
                    alts = data["channel"].get("alternatives", [])
                    if alts:
                        transcript = alts[0].get("transcript", "")
                    is_final = data.get("is_final", False)

                if transcript is None:
                    continue

                if is_final:
                    await self.on_final(transcript)
                else:
                    await self.on_partial(transcript)
        except websockets.ConnectionClosed:
            # socket uzavřen (OK při ukončení streamu)
            pass

    async def feed(self, pcm_bytes: bytes):
        """Pošli jeden audio chunk (PCM16) do Deepgramu."""
        if self.ws:
            await self.ws.send(pcm_bytes)

    async def finish(self):
        """Korektně uzavři stream a dočti zbylé zprávy."""
        try:
            if self.ws:
                # signalizace ukončení streamu pro Deepgram
                await self.ws.send(json.dumps({"type": "CloseStream"}))
        except Exception:
            pass

        # počkej krátce na dočtení reader tasku
        if self.reader_task:
            try:
                await asyncio.wait_for(self.reader_task, timeout=2.0)
            except asyncio.TimeoutError:
                pass

        if self.ws:
            await self.ws.close()

    async def close(self):
        await self.finish()
