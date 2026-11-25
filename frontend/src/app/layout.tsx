import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "KrishiSetu — Agricultural Credit & Risk Intelligence",
  description:
    "Equitable agricultural credit underwriting, agronomic cash-flow forecasting, and priority lending optimization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#f5f5ee] text-[#141513] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
