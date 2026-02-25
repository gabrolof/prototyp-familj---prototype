import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Subscription Prototype",
  description: "Local-only e-commerce flow prototype for family subscriptions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
