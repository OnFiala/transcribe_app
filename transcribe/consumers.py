import json
from channels.generic.websocket import AsyncWebsocketConsumer

class EchoConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(text_data=json.dumps({"system": "WS připojeno"}))

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            await self.send(text_data=text_data)
        elif bytes_data:
            await self.send(bytes_data=bytes_data)

    async def disconnect(self, close_code):
        pass