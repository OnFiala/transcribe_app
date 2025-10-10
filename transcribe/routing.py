from django.urls import re_path
from .consumers import EchoConsumer
from .consumers_audio import AudioConsumer

websocket_urlpatterns = [
    re_path(r"ws/echo/$", EchoConsumer.as_asgi()),
    re_path(r"ws/audio/$", AudioConsumer.as_asgi()),
]