const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');

btnStart.addEventListener('click', () => {
  btnStart.disabled = true;
  btnStop.disabled = false;
});

btnStop.addEventListener('click', () => {
  btnStart.disabled = false;
  btnStop.disabled = true;
});
