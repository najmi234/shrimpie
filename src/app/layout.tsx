import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shrimpie",
  description: "Shrimpie",
  icons: {
    icon: '/Shrimpy-Logo.png', // path relatif ke folder public
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
