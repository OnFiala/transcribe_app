class PCMWorklet extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;
        const ch0 = input[0]; // Float32 [-1, 1]
        const pcm = new Int16Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
            const s = Math.max(-1, Math.min(1, ch0[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; // Float32 → PCM16
        }
        this.port.postMessage(pcm);
        return true; // pokračuj
    }
}
registerProcessor('pcm-worklet', PCMWorklet);