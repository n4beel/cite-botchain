import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Work_Sans, Source_Code_Pro } from "next/font/google";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { app } from "@/lib/app-config";
import "./globals.css";

const serifFont = Libre_Baskerville({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sansFont = Work_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const monoFont = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${app.name} — ${app.tagline}`,
  description: app.tagline,
  openGraph: { title: app.name, description: app.tagline, type: "website", url: app.url },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF7FF",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${serifFont.variable} ${sansFont.variable} ${monoFont.variable} h-full`}
      style={{ ["--accent" as string]: app.accent }}
    >
      <body className="min-h-full antialiased font-sans bg-[#FAF7FF] text-[#1E1233]">
        <EvmProvider>
          <ToastProvider>{children}</ToastProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
