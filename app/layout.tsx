import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SupportBubble } from '@/components/SupportBubble';

export const metadata: Metadata = {
  title: 'Plans Dashboard · Lead It Builders',
  description: 'Read-only portfolio dashboard mirroring Lead It Builders Plans state from ClickUp.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('libTheme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css"
        />
      </head>
      <body>
        {children}
        <SupportBubble />
      </body>
    </html>
  );
}
