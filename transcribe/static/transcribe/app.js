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

// === STT streaming (Deepgram) ===
const sttStart = document.getElementById('startSTT');
const sttStop = document.getElementById('stopSTT');
const sttPartial = document.getElementById('sttPartial');
const sttFinal = document.getElementById('sttFinal');

let wsSTT = null;
let sttCtx = null;
let sttWorklet = null;
let sttStream = null;

// ... nahoře už máš let wsSTT = null; let sttCtx = null; let sttWorklet = null; ...

async function startSTT() {
  // 1) mikrofon
  try {
    sttStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    sttPartial.textContent = 'Přístup k mikrofonu zamítnut: ' + (e.message || e);
    return;
  }

  // 2) WS
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  wsSTT = new WebSocket(`${proto}://${location.host}/ws/stt/`);

  // OCHRANA: nastav handlery až PO vytvoření objektu
  wsSTT.onopen = async () => {
  try {
    sttCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    await sttCtx.audioWorklet.addModule('/static/transcribe/pcm-worklet.js');

    const src = sttCtx.createMediaStreamSource(sttStream);
    sttWorklet = new AudioWorkletNode(sttCtx, 'pcm-worklet');

// tichý sink, aby byl node v grafu, ale nic nehlučelo
    const sink = sttCtx.createGain();
    sink.gain.value = 0.0;
    sttWorklet.connect(sink);
    sink.connect(sttCtx.destination);

    let sent = 0;
    sttWorklet.port.onmessage = (e) => {
      if (wsSTT && wsSTT.readyState === 1) {
        const buf = e.data.buffer; // Int16Array.buffer
        wsSTT.send(buf);           // BINARY AddAudio
          sent += buf.byteLength;
      if (sent >= 48000 * 2) { console.log('STT sent ~', sent, 'bytes'); sent = 0; }
      }
    };

src.connect(sttWorklet);
if (sttCtx.state === 'suspended') await sttCtx.resume();



    // ⬇️ posílat data přes port
   /* sttWorklet.port.onmessage = (e) => { TUHLE ČÁST PŘÍPADNĚ SMAZAT
      if (wsSTT && wsSTT.readyState === 1) {
        wsSTT.send(e.data.buffer);
      }
    }; */

    if (sttCtx.state === 'suspended') await sttCtx.resume();

    sttStart.disabled = true;
    sttStop.disabled = false;
    console.log('STT ready: worklet běží');
  } catch (err) {
    console.error('STT init error:', err);
  }
};


  wsSTT.onmessage = (e) => {
  try {
    const msg = JSON.parse(e.data);

    // ✅ Debug – handshake ze Speechmatics
    if (msg.sm_event) {
      const d = msg.sm_event;
      console.log("SM EVT:", d);

      // volitelné upozornění ve webu
      if (d.type === "warning") {
        sttPartial.textContent = "[warn] " + (d.message || "");
      }
    }

    // ✅ průběžné přepisy
    if (msg.partial) {
      sttPartial.textContent = msg.partial;
    }

    // ✅ dílčí final chunky
    if (msg.final_chunk) {
      sttFinal.textContent += msg.final_chunk + "\n";
    }

    // ✅ kompletní finální přepis
    if (msg.final) {
      sttFinal.textContent += "\n=== FINAL ===\n" + msg.final + "\n";
    }

  } catch (err) {
    console.warn("WS parse error:", err);
  }
};


  wsSTT.onclose = () => {
    sttStart.disabled = false;
    sttStop.disabled = true;
  };
}


function stopSTT() {
  try { if (wsSTT && wsSTT.readyState === 1) wsSTT.send(JSON.stringify({ event: 'stop' })); } catch {}
  try { if (sttWorklet && sttWorklet.disconnect) sttWorklet.disconnect(); } catch {}
  try { if (sttCtx) sttCtx.close(); } catch {}
  try { if (sttStream) sttStream.getTracks().forEach(t => t.stop()); } catch {}
  try { if (wsSTT) wsSTT.close(); } catch {}
  sttStart.disabled = false;
  sttStop.disabled = true;
}




sttStart?.addEventListener('click', startSTT);
sttStop?.addEventListener('click', stopSTT);
