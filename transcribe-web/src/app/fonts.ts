import { Manrope } from "next/font/google";

// Manrope ~ Avenir (velmi čitelný, SIL OFL)
export const brandSans = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-brand-sans",
  display: "swap",
});
