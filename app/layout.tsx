import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import ThemeProvider from './components/ThemeProvider';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: "Interview with the Vampire",
  description: "Your supernatural AI companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable} dark`}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
