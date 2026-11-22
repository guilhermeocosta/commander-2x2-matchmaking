import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commander 2x2 · Matchmaking",
  description: "Pareamento, cronômetro e resultados dos eventos de Commander 2x2.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c151d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="c2x2-dark" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-base-100 text-base-content">{children}</body>
    </html>
  );
}
