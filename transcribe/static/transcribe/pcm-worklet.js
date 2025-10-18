class PCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(0);
    this.targetSamples = Math.round(sampleRate * 0.02); // ~20 ms
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0];

    // akumulace
    const tmp = new Float32Array(this.buf.length + ch0.length);
    tmp.set(this.buf, 0);
    tmp.set(ch0, this.buf.length);
    this.buf = tmp;

    // odesílej po blocích ~20 ms
    while (this.buf.length >= this.targetSamples) {
      const slice = this.buf.subarray(0, this.targetSamples);
      const pcm = new Int16Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        const s = Math.max(-1, Math.min(1, slice[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(pcm);
      this.buf = this.buf.subarray(this.targetSamples);
    }
    return true;
  }
}
registerProcessor('pcm-worklet', PCMWorklet);
