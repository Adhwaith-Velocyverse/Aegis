import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AuthSyncProvider from '@/components/AuthSyncProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aegis - M365 Security Assessment',
  description: 'Automated Microsoft 365 security posture assessment platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛡️</text></svg>" />
      </head>
      <body className={inter.className}>
        <div className="global-bg" aria-hidden="true">
          <div className="global-bg__gradient" />
          <svg className="global-bg__waves" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="rgba(59,130,246,0.12)" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            <path fill="rgba(59,130,246,0.08)" d="M0,256L48,240C96,224,192,192,288,186.7C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,202.7C1248,181,1344,171,1392,165.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
          <div className="global-bg__dots" />
          <svg className="global-bg__network" viewBox="0 0 200 200" aria-hidden="true">
            <g fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="1">
              <circle cx="40" cy="40" r="3" fill="rgba(59,130,246,0.35)" />
              <circle cx="120" cy="30" r="3" fill="rgba(59,130,246,0.35)" />
              <circle cx="160" cy="90" r="3" fill="rgba(59,130,246,0.35)" />
              <circle cx="100" cy="120" r="3" fill="rgba(59,130,246,0.35)" />
              <circle cx="40" cy="160" r="3" fill="rgba(59,130,246,0.35)" />
              <line x1="40" y1="40" x2="120" y2="30" />
              <line x1="120" y1="30" x2="160" y2="90" />
              <line x1="160" y1="90" x2="100" y2="120" />
              <line x1="100" y1="120" x2="40" y2="160" />
              <line x1="40" y1="40" x2="100" y2="120" />
              <line x1="120" y1="30" x2="100" y2="120" />
            </g>
          </svg>
        </div>
        <AuthSyncProvider>
          {children}
        </AuthSyncProvider>
      </body>
    </html>
  );
}
