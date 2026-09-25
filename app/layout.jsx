import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata = {
  title: 'Rutinas GYM',
  description: 'Tu entreno de hoy, series, descansos y progreso.',
  appleWebApp: { capable: true, title: 'Rutinas GYM', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4EFE7' },
    { media: '(prefers-color-scheme: dark)', color: '#121115' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={display.variable + ' ' + body.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
