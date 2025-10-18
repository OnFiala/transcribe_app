from django.urls import re_path
from .consumers import EchoConsumer
from .consumers_audio import AudioConsumer
from .consumers_stt import STTConsumer

websocket_urlpatterns = [
    re_path(r"ws/echo/$", EchoConsumer.as_asgi()),
    re_path(r"ws/audio/$", AudioConsumer.as_asgi()),
    re_path(r"ws/stt/$", STTConsumer.as_asgi()),
]