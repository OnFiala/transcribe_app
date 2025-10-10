const logEl = document.getElementById('log');
const btnConnect = document.getElementById('connect');
const btnDisconnect = document.getElementById('disconnect');
const btnSend = document.getElementById('send');
const input = document.getElementById('msg');

let ws = null;

function log(line) {
  logEl.textContent += line + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

btnConnect.addEventListener('click', () => {
  if (ws && ws.readyState === 1) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/echo/`);

  ws.onopen = () => { log('WS otevřen'); btnConnect.disabled = true; btnDisconnect.disabled = false; };
  ws.onmessage = (e) => { log('← ' + e.data); };
  ws.onclose = () => { log('WS zavřen'); btnConnect.disabled = false; btnDisconnect.disabled = true; };
  ws.onerror = (e) => { log('WS error: ' + (e.message || '')); };
});

btnDisconnect.addEventListener('click', () => {
  if (ws) ws.close();
});

btnSend.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text) return;
  if (!ws || ws.readyState !== 1) { log('WS není připojen'); return; }
  ws.send(JSON.stringify({ message: text }));
  log('→ ' + text);
  input.value = '';
  input.focus();
});