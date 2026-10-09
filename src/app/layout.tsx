import type { Metadata } from 'next';
import Link from 'next/link';
import { JetBrains_Mono, Josefin_Sans, Noto_Sans } from 'next/font/google';

import './globals.css';

const display = Josefin_Sans({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-next-display', display: 'swap' });
const sans = Noto_Sans({ subsets: ['latin'], weight: ['400', '600', '700'], style: ['normal', 'italic'], variable: '--font-next-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-next-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Session library', template: '%s · Session library' },
  description: 'The shared, citable materials of conference sessions, for people and for AI agents.',
  metadataBase: new URL(process.env.SESSIONS_ORIGIN ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${sans.className}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">Skip to content</a>
        <header className="border-b border-stone-200 bg-white">
          <div className="page flex items-baseline justify-between py-3">
            <Link href="/" className="font-display text-lg font-semibold no-underline">Session library</Link>
            <span className="text-xs text-stone-500">dataimago</span>
          </div>
        </header>
        <main id="main" className="flex-1 py-8 sm:py-10">{children}</main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="page space-y-1 py-5 text-sm text-stone-600">
            <p>Materials are shared with their authors&apos; permission and pinned to the public repository they chose to share. Read-only.</p>
            <p>
              For AI agents: <a href="/llms.txt">llms.txt</a> · MCP at <code className="font-mono text-xs">/api/mcp</code> ·{' '}
              <a href="/api/openapi.json">OpenAPI</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
