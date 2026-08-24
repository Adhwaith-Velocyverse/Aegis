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
        <AuthSyncProvider>
          {children}
        </AuthSyncProvider>
      </body>
    </html>
  );
}
