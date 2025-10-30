import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Chat Assistant',
  description: 'Chat with AI, manage sessions, and upload resources',
  generator: 'v0.app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} bg-background text-foreground`}>
        {children}
        <ToastContainer position="top-right" autoClose={3000} closeOnClick pauseOnHover />
      </body>
    </html>
  );
}
