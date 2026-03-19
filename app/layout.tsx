import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { VersionUpdater } from '@/components/version-updater';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { APP_NAME, VERSION } from '@/lib/version';

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: 'Centralised content repository for Axis — the B2B industrial technology platform.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#2323A3',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="app-version" content={VERSION} />
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
          <VersionUpdater />
        </ThemeProvider>
      </body>
    </html>
  );
}
