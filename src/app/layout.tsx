import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "World Cities — Private Board Game",
  description: "A private city-themed Monopoly-style board game for friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
