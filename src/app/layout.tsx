import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "meDiary — Slow Coffee-Shop Media Logging",
  description:
    "Log, review, and curate movies, TV shows, video games, and books in a warm, slow coffee-shop aesthetic.",
  openGraph: {
    title: "meDiary — Media Diary",
    description:
      "Log, review, and curate movies, TV shows, video games, and books.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${workSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans selection:bg-accent/25 selection:text-text">
        {children}
      </body>
    </html>
  );
}
