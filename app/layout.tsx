import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Work_Sans } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wanderlust Travel — Plan your next trip",
  description: "Travel agency site with an AI travel planning assistant.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${workSans.variable}`}>
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
