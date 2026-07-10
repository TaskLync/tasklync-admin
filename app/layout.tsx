import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-loader",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaskLync Admin",
  description: "TaskLync Admin Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-bg-page text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}