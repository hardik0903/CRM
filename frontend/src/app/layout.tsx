import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeScript } from './ThemeScript';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CSV Importer | GrowEasy CRM',
  description:
    'AI-powered CSV importer that intelligently maps, validates, and transforms your data into CRM-ready records.',
  keywords: ['CSV', 'importer', 'CRM', 'AI', 'data import', 'GrowEasy'],
  authors: [{ name: 'GrowEasy' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
