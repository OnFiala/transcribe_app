// src/lib/ws.ts
export type WSHandlers = {
  onOpen?: () => void;
  onError?: (e: Event) => void;
  onClose?: () => void;
  onTranscript?: (data: { text: string; is_final?: boolean }) => void;
};

type AnyMsg = Record<string, unknown>;

export function connectTranscribeWS(url: string, handlers: WSHandlers) {
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  let isOpen = false;
  const queue: AnyMsg[] = [];

  function sendOrQueue(obj: AnyMsg) {
    const payload = JSON.stringify(obj);
    if (isOpen && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else {
      queue.push(obj);
    }
  }

  ws.onopen = () => {
    isOpen = true;
    // flush queue
    while (queue.length) {
      const m = queue.shift()!;
      ws.send(JSON.stringify(m));
    }
    handlers.onOpen?.();
  };

  ws.onerror = (e) => handlers.onError?.(e);
  ws.onclose = () => {
    isOpen = false;
    handlers.onClose?.();
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string);
      if (msg.type === "transcript") handlers.onTranscript?.(msg);
    } catch {
      // ignore non-JSON
    }
  };

  function start(sampleRate = 16000) {
    sendOrQueue({ type: "control", action: "start", sample_rate: sampleRate });
  }
  function stop() {
    sendOrQueue({ type: "control", action: "stop" });
  }
  function sendAudioChunk(base64: string) {
    sendOrQueue({ type: "audio", chunk: base64 });
  }
  function close() {
    try { ws.close(); } catch { /* noop */ }
  }

  return { start, stop, sendAudioChunk, close };
}
