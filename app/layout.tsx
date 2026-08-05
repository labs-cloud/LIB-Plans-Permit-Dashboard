import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { SupportBubble } from '@/components/SupportBubble';
import { SCOPE_HEADER, TEAM_SCOPE } from '@/lib/access';

export const metadata: Metadata = {
  title: 'Plans Dashboard · Lead It Builders',
  description: 'Read-only portfolio dashboard mirroring Lead It Builders Plans state from ClickUp.',
  // The dashboard is private and link-shared; keep every page out of indexes.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('libTheme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The support bubble posts to a team-only endpoint, so it would just fail for a
  // share viewer — and outside parties shouldn't be filing internal tickets anyway.
  const scope = (await headers()).get(SCOPE_HEADER);
  const isTeam = scope === TEAM_SCOPE;

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
        {isTeam && <SupportBubble />}
      </body>
    </html>
  );
}
