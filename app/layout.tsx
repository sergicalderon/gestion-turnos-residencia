import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { AuthGate } from "@/components/auth-gate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestión de turnos",
  description: "MVP interno para planillas y control horario de residencia",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-paper text-ink">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <AuthGate>{children}</AuthGate>
          </main>
        </div>
      </body>
    </html>
  );
}
