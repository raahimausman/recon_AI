import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UploadedSourcesProvider } from '@/context/UploadedSourcesContext';
import { PackageProvider } from '@/context/PackageContext';
import { SelectedModeProvider } from '@/context/SelectedModeContext';
import { ReconciliationResultProvider } from "@/context/ReconciliationResultContext";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recon AI - Document Reconciliation Platform",
  description: "An AI reimbursement reconciliation agent that automates invoice, proof of payment, and summary validation through integrated document-matching workflows with discrepancy detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UploadedSourcesProvider>
          <PackageProvider>
            <SelectedModeProvider>
              <ReconciliationResultProvider>
                <AuthProvider>
                  {children}
                </AuthProvider>
              </ReconciliationResultProvider>
            </SelectedModeProvider>
          </PackageProvider>
        </UploadedSourcesProvider>
      </body>
    </html>
  );
}