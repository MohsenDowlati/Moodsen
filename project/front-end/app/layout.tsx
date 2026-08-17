import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Moodsen — Track how you feel, one day at a time',
  description:
    'A simple, beautiful mood tracker. Log your day, spot patterns, and understand yourself better.',
  openGraph: {
    title: 'Moodsen — Track how you feel, one day at a time',
    description:
      'A simple, beautiful mood tracker. Log your day, spot patterns, and understand yourself better.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
