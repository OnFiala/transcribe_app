// public/worklets/pcm-processor.js
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options?.processorOptions || {};
    this.targetSampleRate = o.sampleRate || sampleRate; // AudioContext rate
    this.batchMs = o.batchMs ?? 100; // posílat ~ každých 100 ms
    this._buffer = [];
    this._bufferSamplesTarget = Math.round(this.targetSampleRate * (this.batchMs / 1000));
  }

  // převod Float32 [-1,1] -> Int16
  _floatToInt16(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    // mono (kanál 0)
    const channel = input[0]; // Float32Array of 128 frames per render quantum
    if (!channel) return true;

    // nasbírat do bufferu
    this._buffer.push(channel.slice(0)); // kopie kvanta

    // pokud máme ~100ms dat, pošleme balík hlavnímu vláknu
    const samples = this._buffer.reduce((acc, arr) => acc + arr.length, 0);
    if (samples >= this._bufferSamplesTarget) {
      const merged = new Float32Array(samples);
      let off = 0;
      for (const arr of this._buffer) {
        merged.set(arr, off);
        off += arr.length;
      }
      this._buffer = [];

      const i16 = this._floatToInt16(merged);
      // Pošli ArrayBuffer (transferable) – žádné kopírování
      this.port.postMessage(i16.buffer, [i16.buffer]);
    }
    return true; // keep processor alive
  }
}

registerProcessor('pcm-processor', PCMProcessor);
