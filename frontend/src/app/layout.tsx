import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth/context';
import { ThemeProvider } from '@/components/layout/ThemeProvider';

const inter      = Inter({ subsets: ['latin'], variable: '--font-sans' });
const geistSans  = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono  = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RSA — Route Safety Analysis by Grupo3S',
  description: 'Sistema privado para reportar y visualizar siniestros y novedades en ruta.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn('h-full antialiased', geistSans.variable, geistMono.variable, 'font-sans', inter.variable)}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
