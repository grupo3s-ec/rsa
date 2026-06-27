import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/lib/auth/context';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';

const inter      = Inter({ subsets: ['latin'], variable: '--font-sans' });
const geistSans  = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono  = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RSA — Rutas Seguras',
  description: 'Sistema de análisis y reporte de incidentes en ruta para transporte pesado.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RSA',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/rsa-logo.jpeg',
  },
};

export const viewport: Viewport = {
  themeColor: '#1A3562',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn('h-full antialiased', geistSans.variable, geistMono.variable, 'font-sans', inter.variable)}
    >
      <body className="flex min-h-full flex-col">
        {/* Polyfill __name: @opennextjs/cloudflare inyecta este helper de esbuild en el script de next-themes, pero no existe en el browser */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script dangerouslySetInnerHTML={{ __html: 'var __name=(f,n)=>{try{Object.defineProperty(f,"name",{value:n,configurable:!0})}catch(e){}return f};' }} />
        <ThemeProvider>
          <AuthProvider>
            {children}
            <ServiceWorkerRegistration />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
