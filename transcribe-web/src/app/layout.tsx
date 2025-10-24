import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { brandSans} from "./fonts";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Transcribe App",
  description: "Voice-first přepis a analýzy",
  icons: {
    icon: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/apple-touch-icon-precomposed.png", sizes: "180x180" },
    ],
  },
  manifest: "/site.webmanifest", // volitelně, viz níže
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className={`${brandSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
