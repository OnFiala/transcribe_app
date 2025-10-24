"use client";

import { useMicStream} from "@/hooks/useMicStream";
import React, { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Mic,
  BrainCircuit,
  AudioWaveform,
  PanelRightClose,
  PanelRightOpen,
  FileAudio,
  Cog,
  MessageSquare,
  Wand2,
  Languages,
  Highlighter,
  Download,
  Settings2,
  SquareFunction,
  Menu,
  Upload,
  Play,
  StopCircle,
  Loader2,
  Check,
} from "lucide-react";
import { uploadAudioFile, createSummary, translateText, askLLM } from "@/lib/api";
import { connectTranscribeWS } from "@/lib/ws";



// Color palette (kept as constants; base is enforced by design tokens in globals.css)
const COLOR_MAIN_BG = "#52C6BD"; // main page background
const COLOR_SIDEBAR_BG = "#391AA6"; // left sidebar background

const WS_URL = process.env.NEXT_PUBLIC_WS_URL!;


// Feature model
type FeatureKey =
  | "live-mic"
  | "file-transcribe"
  | "summary"
  | "translate"
  | "llm"
  | "settings";

const FEATURES: Array<{
  key: FeatureKey;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "live-mic", label: "Živý přepis", icon: <Mic className="size-4" /> },
  { key: "file-transcribe", label: "Přepis souboru", icon: <FileAudio className="size-4" /> },
  // { key: "denoise", label: "Čištění šumu", icon: <AudioWaveform className="size-4" /> },
  { key: "summary", label: "Shrnutí & kapitoly", icon: <Wand2 className="size-4" /> },
  { key: "translate", label: "Překlad", icon: <Languages className="size-4" /> },
  // { key: "autoclean", label: "Auto-clean & formát", icon: <Highlighter className="size-4" /> },
  // { key: "diarization", label: "Analýza řeči (diarizace)", icon: <SquareFunction className="size-4" /> },
  { key: "llm", label: "LLM nástroje (Q&A)", icon: <BrainCircuit className="size-4" /> },
  { key: "settings", label: "Nastavení", icon: <Cog className="size-4" /> },
];

// Simple toast system (no external deps)
type Toast = { id: number; title?: string; message: string };

export default function TranscribeAppShell() {
  const [active, setActive] = useState<FeatureKey>("live-mic");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const activeLabel = useMemo(() => FEATURES.find(f => f.key === active)?.label ?? "", [active]);

  const pushToast = useCallback((message: string, title?: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

    // === Handlery pro napojení na backend ===

  async function handleMicStart() {
  try {
    const conn = connectTranscribeWS(WS_URL, {
      onOpen: () => {
        pushToast("WS připojeno", "Mic");
        conn.start(48000);
        mic.start(); // 🔥 zapne mikrofon
      },
      onTranscript: (m) => {
        console.log("partial:", m.text);
      },
      onClose: () => pushToast("WS odpojeno", "Mic"),
      onError: () => pushToast("WS chyba", "Mic"),
    });
    setWsConn(conn);
    setMicOn(true);
  } catch (e) {
    pushToast(`Mic error: ${String(e)}`, "Mic");
  }
}

function handleMicStop() {
  try {
    mic.stop(); // 🔥 vypne mikrofon
    wsConn?.stop();
    wsConn?.close();
  } finally {
    setWsConn(null);
    setMicOn(false);
  }
}


  async function handleFileUpload() {
    if (!selectedFile) {
      pushToast("Nejprve vyber soubor.", "Upload");
      return;
    }
    try {
      setUploading(true);
      const res = await uploadAudioFile(selectedFile, { language: "cs" });
      setTranscriptId(res.transcript_id);
      pushToast("Soubor nahrán – přepis běží.", "Upload");
    } catch (e) {
      pushToast(`Upload failed: ${String(e)}`, "Chyba");
    } finally {
      setUploading(false);
    }
  }

  async function handleSummary() {
    try {
      setGenerating(true);
      const res = await createSummary({ transcript_id: transcriptId });
      pushToast(res.summary ?? "Shrnutí hotovo.", "Shrnutí");
    } catch (e) {
      pushToast(`Summary failed: ${String(e)}`, "Chyba");
    } finally {
      setGenerating(false);
    }
  }

  async function handleTranslate() {
    try {
      setGenerating(true);
      const res = await translateText({ transcript_id: transcriptId, target_lang: targetLang });
      pushToast(res.translated?.slice(0, 120) + "…", "Překlad");
    } catch (e) {
      pushToast(`Translate failed: ${String(e)}`, "Chyba");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAskLLM() {
    if (!llmQuestion.trim()) {
      pushToast("Zadej otázku.", "LLM");
      return;
    }
    try {
      setGenerating(true);
      const res = await askLLM({ transcript_id: transcriptId, question: llmQuestion.trim() });
      pushToast(res.answer ?? "Odpověď připravena.", "LLM");
    } catch (e) {
      pushToast(`Q&A failed: ${String(e)}`, "Chyba");
    } finally {
      setGenerating(false);
    }
  }




  // State for mock actions
  const [micOn, setMicOn] = useState(false);
  const mic = useMicStream({
    onChunk: (b64) => wsConn?.sendAudioChunk(b64),
    onError: (err) => pushToast(`Mic chyba: ${err.message}`, "Mic"),
    sampleRate: 48000, // 🔥 sjednoceno se Speechmatics (SM_SR)
    batchMS: 100,
  });


  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);

      // Backend napojení
  const [wsConn, setWsConn] = useState<ReturnType<typeof connectTranscribeWS> | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | undefined>(undefined);

  // UI stavy pro Translate/LLM
  const [targetLang, setTargetLang] = useState<string>("en");
  const [llmQuestion, setLlmQuestion] = useState<string>("");


  // Drag & drop handlers
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      pushToast(`Vybrán soubor: ${file.name}`, "Soubor přidán");
    }
  };

  return (
    <TooltipProvider>
      <div
        className="min-h-screen w-full grid transition-[grid-template-columns] duration-300"
        style={{
          gridTemplateColumns: sidebarCollapsed ? "80px 1fr" : "320px 1fr",
          backgroundColor: COLOR_MAIN_BG,
          color: "#000000",
        }}
      >
        {/* Left sidebar */}
        <aside
          className="h-full relative hidden md:flex"
          style={{ background: COLOR_SIDEBAR_BG }}
        >
          <div className="h-full flex flex-col w-full">
            {/* Sidebar header */}
            <div className="px-3 py-4 border-b border-white/15 flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold tracking-tight truncate">
                {sidebarCollapsed ? "" : "Funkce"}
              </h2>
              <Button
                variant="ghost"
                className="text-white/80 hover:text-white"
                size="icon"
                onClick={() => setSidebarCollapsed(v => !v)}
                aria-label={sidebarCollapsed ? "Rozbalit panel" : "Sbalit panel"}
              >
                {sidebarCollapsed ? <PanelRightOpen className="size-5" /> : <PanelRightClose className="size-5" />}
              </Button>
            </div>

            {/* Feature list */}
            <ScrollArea className="flex-1">
              <div className="px-2 py-3 space-y-1">
                {FEATURES.map(f => (
                  <SidebarItem
                    key={f.key}
                    icon={f.icon}
                    label={f.label}
                    active={active === f.key}
                    collapsed={sidebarCollapsed}
                    onClick={() => setActive(f.key)}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Sidebar footer */}
            <div className="px-4 py-4 border-t border-white/15 text-white/80 text-xs">
              © {new Date().getFullYear()} Transcribe App
            </div>
          </div>
        </aside>

        {/* Mobile sidebar (overlay) */}
        {sidebarOpenMobile && (
          <div className="md:hidden fixed inset-0 z-40" aria-modal="true" role="dialog">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpenMobile(false)} />
            <div className="absolute inset-y-0 left-0 w-[80vw] max-w-[320px]" style={{ background: COLOR_SIDEBAR_BG }}>
              <div className="px-4 py-4 border-b border-white/15 flex items-center justify-between">
                <h2 className="text-white text-lg font-semibold tracking-tight">Funkce</h2>
                <Button variant="ghost" className="text-white/80 hover:text-white" size="icon" onClick={() => setSidebarOpenMobile(false)}>
                  <PanelRightClose className="size-5" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100vh-120px)]">
                <div className="px-2 py-3 space-y-1">
                  {FEATURES.map(f => (
                    <SidebarItem
                      key={f.key}
                      icon={f.icon}
                      label={f.label}
                      active={active === f.key}
                      collapsed={false}
                      onClick={() => { setActive(f.key); setSidebarOpenMobile(false); }}
                    />
                  ))}
                </div>
              </ScrollArea>
              <div className="px-4 py-4 border-t border-white/15 text-white/80 text-xs">© {new Date().getFullYear()} Transcribe App</div>
            </div>
          </div>
        )}

        {/* Main content area */}
        <main className="relative flex flex-col">
          {/* Top app bar */}
          <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b">
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile menu toggle */}
                <Button className="md:hidden" size="icon" variant="outline" onClick={() => setSidebarOpenMobile(true)} aria-label="Otevřít nabídku">
                  <Menu className="size-5" />
                </Button>
                {/* Simple logo mark */}
                <svg width="28" height="28" viewBox="0 0 28 28" className="rounded-xl" aria-hidden="true">
                  <rect width="28" height="28" rx="8" fill={COLOR_SIDEBAR_BG} />
                  <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fontWeight="700" fill="#FFFFFF">T</text>
                </svg>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: "#111" }}>
                  Transcribe App
                </h1>
                <span className="hidden md:inline text-xs text-black/60">{activeLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-xl">New Session</Button>
                <Button className="rounded-xl" style={{ background: COLOR_SIDEBAR_BG, color: "#fff" }}>
                  <Settings2 className="mr-2 size-4" /> Settings
                </Button>
              </div>
            </div>
          </header>

          {/* Action/result stream */}
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl w-full p-4 md:p-6 lg:p-8 space-y-6">
              {/* Contextual panel by active feature */}
              <Card className="rounded-2xl shadow-lg border-0 transition-all">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base md:text-lg" style={{ color: "#111" }}>
                    {activeLabel || "Vítej! Tohle je hlavní pracovní plocha."}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed space-y-4" style={{ color: "#000" }}>
                  {active === "live-mic" && (
                    <div className="space-y-3">
                      <p>Tady spustíš živý přepis z mikrofonu. (Napojeno na WS „/ws/audio“.)</p>
                      <div className="flex gap-2">
                        {!micOn ? (
                        <Button onClick={handleMicStart} className="rounded-xl">
                          <Play className="mr-2 size-4" /> Spustit záznam
                        </Button>
                         ) : (
                        <Button onClick={handleMicStop} className="rounded-xl" variant="secondary">
                        <StopCircle className="mr-2 size-4" /> Zastavit
                        </Button>
                        )}
                      </div>
                    </div>
                  )}


                  {active === "file-transcribe" && (
                    <div className="space-y-3">
                      <p>Nahraj audio soubor (mp3, wav, m4a…). Mock upload ukáže toast a náhled.</p>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                        className="border-2 border-dashed rounded-2xl p-6 bg-white/60 hover:bg-white/80 transition-colors"
                      >
                        <div className="flex items-center justify-center gap-2 text-black/70">
                          <Upload className="size-4" /> Přetáhni sem soubor nebo vyber ručně
                        </div>
                        <div className="mt-3">
                          <Input type="file" accept="audio/*" onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            setSelectedFile(f);
                            if (f) pushToast(`Vybrán soubor: ${f.name}`, "Soubor přidán");
                          }} />
                        </div>
                      </div>
                      {selectedFile && (
                        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3">
                          <div className="text-sm"><strong>Soubor:</strong> {selectedFile.name}</div>
                          <Button
                            className="rounded-xl"
                            disabled={uploading}
                              onClick={handleFileUpload}
                          >
                            {uploading ? (<><Loader2 className="mr-2 size-4 animate-spin" /> Nahrávám…</>) : (<><Upload className="mr-2 size-4" /> Odeslat</>)}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {active === "summary" && (
                    <div className="space-y-3">
                      <p>Vytvoř shrnutí z posledního přepisu. (Mock – ukážeme toast po vygenerování.)</p>
                      <Button
                        className="rounded-xl"
                        disabled={generating}
                        onClick={handleSummary}
                      >
                        {generating ? (<><Loader2 className="mr-2 size-4 animate-spin" /> Generuji…</>) : (<><Wand2 className="mr-2 size-4" /> Vygenerovat shrnutí</>)}
                      </Button>
                    </div>
                  )}

                  {active === "translate" && (
                    <div className="space-y-3">
                      <p>Přelož poslední přepis do vybraného jazyka. (Mock akce.)</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="rounded-xl border px-3 py-2"
                          value={targetLang}
                          onChange={(e) => setTargetLang(e.target.value)}
                        >
                          <option value="en">English</option>
                          <option value="de">Deutsch</option>
                          <option value="es">Español</option>
                          <option value="pl">Polski</option>
                        </select>
                        <Button className="rounded-xl" onClick={handleTranslate}>Přeložit</Button>
                      </div>
                    </div>
                  )}

                  {active === "llm" && (
                    <div className="flex items-end gap-2">
                      <Input
                        placeholder="Např. ‚Co bylo hlavním tématem?‘"
                        className="rounded-xl"
                        value={llmQuestion}
                        onChange={(e) => setLlmQuestion(e.target.value)}
                    />
                      <Button className="rounded-xl" onClick={handleAskLLM}>Zeptat se</Button>
                    </div>
                  )}

                  {active === "settings" && (
                    <div className="space-y-3">
                      <p>Nastavení aplikace (motiv, jazyk UI, výstupní formáty…).</p>
                      <Button variant="secondary" className="rounded-xl" onClick={() => pushToast("Nastavení uloženo.", "Settings")}>
                        Uložit změny
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Example action card */}
              <Card className="rounded-2xl shadow-md border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base md:text-lg" style={{ color: "#111" }}>
                    Přepis – ukázka
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm" style={{ color: "#000" }}>
                  <div className="leading-relaxed">
                    <p>
                      „Dobrý den, vítáme vás na dnešní přednášce. Cílem je ukázat architekturu audio streamingu a STT v reálném čase…“
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="secondary" className="rounded-xl">
                      <Highlighter className="mr-2 size-4" /> Vyčistit text
                    </Button>
                    <Button variant="secondary" className="rounded-xl">
                      <Languages className="mr-2 size-4" /> Přeložit
                    </Button>
                    <Button variant="secondary" className="rounded-xl">
                      <Wand2 className="mr-2 size-4" /> Shrnutí
                    </Button>
                    <Button variant="secondary" className="rounded-xl">
                      <Download className="mr-2 size-4" /> Export
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-md border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base md:text-lg" style={{ color: "#111" }}>
                    Analýzy & poznámky
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm" style={{ color: "#000" }}>
                  Každý další krok se objeví jako nový bílý kontejner. Lze řadit, filtrovat a připnout.
                </CardContent>
              </Card>

              <div className="h-20" />
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="sticky bottom-0 z-20 border-t bg-white/90 backdrop-blur">
            <div className="mx-auto max-w-3xl w-full p-4">
              <div className="flex items-end gap-2">
                <Input
                  placeholder="Zadej příkaz… (např. ‘Začni přepisovat mikrofon’)"
                  className="rounded-2xl border-2 text-base py-6"
                  style={{ color: "#111" }}
                />
                <Button className="rounded-2xl px-5 py-6 text-base" style={{ background: COLOR_SIDEBAR_BG, color: "#fff" }}>
                  <MessageSquare className="mr-2 size-5" /> Odeslat
                </Button>
              </div>
              <div className="mt-2 text-xs text-black/70">
                Tip: Piš přirozeně. Akce a výsledky se objeví nahoře jako karty.
              </div>
            </div>
          </div>
        </main>

        {/* Toasts */}
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] space-y-2">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto bg-white text-black shadow-lg rounded-xl px-4 py-3 border flex items-start gap-3 min-w-[260px]">
              <div className="mt-0.5"><Check className="size-4" /></div>
              <div className="text-sm">
                {t.title && <div className="font-semibold mb-0.5">{t.title}</div>}
                <div>{t.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <Button
      onClick={onClick}
      variant="ghost"
      className={`w-full justify-start gap-2 rounded-xl text-white/95 hover:text-white hover:bg-white/10 ${
        active ? "bg-white/15 text-white" : ""
      } ${collapsed ? "px-2" : ""}`}
    >
      <span className="inline-flex items-center justify-center size-7 rounded-lg bg-white/10">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Button>
  );

  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" className="text-sm">
        {label}
      </TooltipContent>
    </Tooltip>
  ) : (
    content
  );
}
