import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import "./globals.css";
import LanguageSelector from "./language-selector";
import QueryProvider from "@/providers/query-provider";
import { DbHealthMonitor } from "@/components/db-health-monitor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Birthude · Create your invitations",
  description: "Create your invitations",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <html lang={locale}>
          <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
            {children}
            <LanguageSelector />
            <DbHealthMonitor />
          </body>
        </html>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
