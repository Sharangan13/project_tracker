import './globals.css';

export const metadata = { title: 'Module Task Tracker', description: 'Assign and track module tasks across your teams.' };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
