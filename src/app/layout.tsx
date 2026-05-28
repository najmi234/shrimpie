import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";

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
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
