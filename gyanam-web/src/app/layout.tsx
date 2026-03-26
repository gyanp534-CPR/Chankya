import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gyanam",
  description: "Adaptive learning dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 font-sans text-gray-900 antialiased">{children}</body>
    </html>
  );
}
