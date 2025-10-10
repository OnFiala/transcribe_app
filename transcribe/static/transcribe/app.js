// === Echo z Kroku 2 ===
const logEl = document.getElementById('log');
const btnConnect = document.getElementById('connect');
const btnDisconnect = document.getElementById('disconnect');
const btnSend = document.getElementById('send');
const input = document.getElementById('msg');

let wsEcho = null;
function log(line) { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; }

btnConnect?.addEventListener('click', () => {
  if (wsEcho && wsEcho.readyState === 1) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  wsEcho = new WebSocket(`${proto}://${location.host}/ws/echo/`);
  wsEcho.onopen = () => { log('WS otevřen'); btnConnect.disabled = true; btnDisconnect.disabled = false; };
  wsEcho.onmessage = (e) => { log('← ' + e.data); };
  wsEcho.onclose = () => { log('WS zavřen'); btnConnect.disabled = false; btnDisconnect.disabled = true; };
  wsEcho.onerror = (e) => { log('WS error: ' + (e.message || '')); };
});
btnDisconnect?.addEventListener('click', () => { if (wsEcho) wsEcho.close(); });
btnSend?.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text) return;
  if (!wsEcho || wsEcho.readyState !== 1) { log('WS není připojen'); return; }
  const payload = JSON.stringify({ message: text });
  wsEcho.send(payload);
  log('→ ' + payload);
  input.value = '';
});

// === Audio streaming (Krok 3) ===
const startBtn = document.getElementById('startAudio');
const stopBtn = document.getElementById('stopAudio');
const audioStatus = document.getElementById('audioStatus');
const bytesEl = document.getElementById('bytes');

let wsAudio = null;
let audioContext = null;
let workletNode = null;
let mediaStream = null;

async function startAudio() {
  // 1) požádej o mikrofon
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    audioStatus.textContent = 'Přístup k mikrofonu zamítnut: ' + err.message;
    return;
  }

  // 2) otevři WS
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  wsAudio = new WebSocket(`${proto}://${location.host}/ws/audio/`);

  wsAudio.onopen = async () => {
    audioStatus.textContent = 'WS audio otevřen';

    // 3) zkusit AudioWorklet s resamplovaným AudioContextem na 16kHz
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      await audioContext.audioWorklet.addModule('/static/transcribe/pcm-worklet.js');
      const source = audioContext.createMediaStreamSource(mediaStream);
      workletNode = new AudioWorkletNode(audioContext, 'pcm-worklet');

      workletNode.port.onmessage = (e) => {
        // e.data je Int16Array — pošleme jako ArrayBuffer
        if (wsAudio && wsAudio.readyState === 1) wsAudio.send(e.data.buffer);
      };

      source.connect(workletNode);
      // Nepřipojuj do destination, aby nic nehrálo do repráků

      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      // 4) Fallback: MediaRecorder (Safari/Starší)
      audioStatus.textContent = 'Fallback MediaRecorder: ' + (err.message || err);
      try {
        const rec = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size) {
            // Pošleme blob jako ArrayBuffer (opus/webm). Server zatím jen sčítá bajty.
              ev.data.arrayBuffer().then((buf) => {
                if (wsAudio && wsAudio.readyState === 1) wsAudio.send(buf);
              });
            }
          };
          rec.start(250); // pošle chunk každých 250ms
          // Uložíme pro stop()
          workletNode = { port: { postMessage: () => {} }, close: () => rec.stop() };
          startBtn.disabled = true;
          stopBtn.disabled = false;
        } catch (e2) {
          audioStatus.textContent = 'MediaRecorder nelze použít: ' + (e2.message || e2);
        }
      }
    };

    wsAudio.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (typeof msg.bytes === 'number') bytesEl.textContent = String(msg.bytes);
        if (msg.done) audioStatus.textContent = 'Ukončeno. Celkem bajtů: ' + msg.total_bytes;
      } catch {}
    };

    wsAudio.onclose = () => {
      audioStatus.textContent = 'WS audio zavřen';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    };

    wsAudio.onerror = (e) => {
      audioStatus.textContent = 'WS audio error';
      console.error(e);
    };
  }

function stopAudio() {
  try { if (wsAudio && wsAudio.readyState === 1) wsAudio.send(JSON.stringify({ event: 'stop' })); } catch {}
  try { if (workletNode && workletNode.disconnect) workletNode.disconnect(); } catch {}
  try { if (audioContext) audioContext.close(); } catch {}
  try { if (mediaStream) mediaStream.getTracks().forEach(t => t.stop()); } catch {}
  try { if (wsAudio) wsAudio.close(); } catch {}
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn?.addEventListener('click', startAudio);
stopBtn?.addEventListener('click', stopAudio);