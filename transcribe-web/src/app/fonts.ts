// src/app/fonts.ts
import { Manrope } from "next/font/google";

// Manrope je velmi podobný Aveniru a má dobrou čitelnost.
// Přidáme latin-ext kvůli češtině a typické řezy pro UI.
export const brandSans = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-brand-sans",
  display: "swap",
});
