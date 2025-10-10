import json
from channels.generic.websocket import AsyncWebsocketConsumer

class AudioConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.total_bytes = 0
        await self.accept()
        await self.send(text_data=json.dumps({"system": "Audio WS připojeno"}))

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is not None:
            self.total_bytes += len(bytes_data)
            # posíláme průběžný stav do UI
            await self.send(text_data=json.dumps({
                "bytes": self.total_bytes
            }))
        elif text_data is not None:
            # očekáváme např. {"event": "stop"}
            try:
                msg = json.loads(text_data)
            except Exception:
                msg = {}
            if msg.get("event") == "stop":
                await self.send(text_data=json.dumps({
                    "done": True,
                    "total_bytes": self.total_bytes
                }))
                await self.close()

async def disconnect(self, close_code):
    pass