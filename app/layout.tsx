import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grokify · build something worth launching",
  description: "Turn a conversation into a working product, a token, and a transparent revenue engine.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
