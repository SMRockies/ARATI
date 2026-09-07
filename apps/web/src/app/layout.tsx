import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arati ERP',
  description: 'Operational workspace for distribution, wholesale, retail, and inventory teams.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
