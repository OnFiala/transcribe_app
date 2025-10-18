# transcribe/consumers_stt.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from .services.stt_speechmatics import SpeechmaticsStream

# ...
class STTConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.final_parts = []

        async def on_partial(text: str):
            await self.send(text_data=json.dumps({"partial": text}))

        async def on_final(text: str):
            self.final_parts.append(text)
            await self.send(text_data=json.dumps({"final_chunk": text}))

        async def on_event(evt: dict):
            await self.send(text_data=json.dumps({"sm_event": evt}))

        self.sm = SpeechmaticsStream(on_partial=on_partial, on_final=on_final, on_event=on_event)
        await self.accept()
        await self.sm.start()
        await self.send(text_data=json.dumps({"system": "Speechmatics STT připojeno"}))

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is not None:
            await self.sm.feed(bytes_data)
        elif text_data is not None:
            try:
                msg = json.loads(text_data)
            except Exception:
                msg = {}
            if msg.get("event") == "stop":
                await self.sm.finish()
                final_text = "\n".join(self.final_parts).strip()
                await self.send(text_data=json.dumps({"final": final_text}))
                await self.close()

    async def disconnect(self, close_code):
        try:
            await self.sm.close()
        except Exception:
            pass
