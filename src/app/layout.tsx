import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Recuperadora Menegatti — Gestão Financeira',
    template: '%s · Menegatti',
  },
  description:
    'Sistema de gestão financeira e precificação industrial da Recuperadora Menegatti — ' +
    'usinagem, solda, caldeiraria, montagem e acabamento.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0A0F1E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    // A classe do tema é aplicada pelo script do next-themes antes da
    // primeira pintura. Fixá-la aqui faria o usuário de modo claro ver um
    // piscar escuro a cada carregamento de página.
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
