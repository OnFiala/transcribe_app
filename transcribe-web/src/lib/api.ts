// src/lib/api.ts
const API = process.env.NEXT_PUBLIC_API_URL!;

export async function uploadAudioFile(file: File, extra?: Record<string, string>) {
  const fd = new FormData();
  fd.set("file", file);
  Object.entries(extra ?? {}).forEach(([k, v]) => fd.set(k, v));
  const res = await fetch(`${API}/api/transcribe/`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json() as Promise<{ job_id: string; transcript_id?: string }>;
}

export async function createSummary(payload: { transcript_id?: string; text?: string }) {
  const res = await fetch(`${API}/api/summary/`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Summary failed");
  return res.json() as Promise<{ summary: string }>;
}

export async function translateText(payload: { transcript_id?: string; text?: string; target_lang: string }) {
  const res = await fetch(`${API}/api/translate/`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Translate failed");
  return res.json() as Promise<{ translated: string }>;
}

export async function askLLM(payload: { transcript_id?: string; question: string }) {
  const res = await fetch(`${API}/api/qa/`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Q&A failed");
  return res.json() as Promise<{ answer: string }>;
}
