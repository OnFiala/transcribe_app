"use client";
import React, { useMemo, useState } from "react";
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
} from "lucide-react";

// Color palette (kept as constants; base is enforced by design tokens in globals.css)
const COLOR_MAIN_BG = "#52C6BD"; // main page background
const COLOR_SIDEBAR_BG = "#391AA6"; // left sidebar background

// Feature model
type FeatureKey =
  | "live-mic"
  | "file-transcribe"
  | "denoise"
  | "summary"
  | "translate"
  | "autoclean"
  | "diarization"
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

export default function TranscribeAppShell() {
  const [active, setActive] = useState<FeatureKey>("live-mic");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  const activeLabel = useMemo(() => FEATURES.find(f => f.key === active)?.label ?? "", [active]);

  return (
    <TooltipProvider>
      <div
        className="min-h-screen w-full grid"
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
              {/* Contextual empty state */}
              <Card className="rounded-2xl shadow-lg border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base md:text-lg" style={{ color: "#111" }}>
                    {activeLabel || "Vítej! Tohle je hlavní pracovní plocha."}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed" style={{ color: "#000" }}>
                  {active === "live-mic" && (
                    <p className="mb-2">Připravíme přepis z mikrofonu v reálném čase. Klikni na <strong>Živý přepis (Mic)</strong> a spusť záznam.</p>
                  )}
                  {active === "file-transcribe" && (
                    <p className="mb-2">Nahraj audio soubor a spusť asynchronní přepis. Výsledek se objeví v nové kartě s možností čištění a exportu.</p>
                  )}
                  {active === "diarization" && (
                    <p className="mb-2">Diarizace rozpozná jednotlivé mluvčí v nahrávce. Po dokončení zobrazíme časovou osu mluvčích.</p>
                  )}
                  {active !== "live-mic" && active !== "file-transcribe" && active !== "diarization" && (
                    <p>Každý výstup je v samostatném bílém panelu se silným kontrastem pro perfektní čitelnost.</p>
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
