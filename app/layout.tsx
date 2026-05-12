import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plans & Permits Dashboard · Lead It Builders',
  description: 'Read-only portfolio dashboard mirroring Lead It Builders Plans & Permits state from ClickUp.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
