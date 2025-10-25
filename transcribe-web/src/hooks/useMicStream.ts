"use client";

import { useEffect, useRef } from "react";

export interface MicStreamOptions {
  onChunk: (base64Chunk: string) => void;

  onError?: (err: Error) => void;
  sampleRate?: number; // default 48000
  batchMs?: number;    // default 100
}

export function useMicStream({ onChunk, onError, sampleRate = 48000, batchMs = 100 }: MicStreamOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const runningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    try {
      if (runningRef.current) return;
      runningRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate });
      audioContextRef.current = audioCtx;

      // načti worklet modul
      await audioCtx.audioWorklet.addModule("/worklets/pcm-processor.js");

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // vytvoř node s našimi volbami
      const node = new AudioWorkletNode(audioCtx, "pcm-processor", {
        processorOptions: { sampleRate: audioCtx.sampleRate, batchMs },
      });
      workletRef.current = node;

      // poslech zpráv z workletu (ArrayBuffer s Int16)
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        try {
          const buf = e.data; // Int16 PCM buffer
          const b64 = arrayBufferToBase64(buf);
          onChunk(b64);
        } catch (err) {
          onError?.(err as Error);
        }
      };

      // pro jistotu node nepošle audio ven
      node.connect(audioCtx.destination);
      source.connect(node);
    } catch (err) {
      onError?.(err as Error);
    }
  }

  function stop() {
    runningRef.current = false;

    try { sourceRef.current?.disconnect(); } catch {}
    try { workletRef.current?.disconnect(); } catch {}
    try { audioContextRef.current?.close(); } catch {}

    workletRef.current = null;
    sourceRef.current = null;

    // vypnout media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    audioContextRef.current = null;
  }

  useEffect(() => () => stop(), []);

  return { start, stop };
}

// Helpers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}
