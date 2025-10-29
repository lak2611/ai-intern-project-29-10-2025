import type React from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Chat Assistant',
  description: 'Chat with AI, manage sessions, and upload resources',
  generator: 'v0.app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} bg-background text-foreground`}>
        {children}
        <ToastContainer position="top-right" autoClose={3000} newestOnTop closeOnClick pauseOnHover />
      </body>
    </html>
  );
}
