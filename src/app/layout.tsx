import type { Metadata } from "next";
import "./globals.css";

import ReactQueryProvider from "@/app/providers/ReactQueryproviders";
import DealerTermsGate from "@/components/terms/DealerTermsGate";

export const metadata: Metadata = {
  title: "Omsons",
  description: "Omsons Germany",
  icons: {
    icon: "/omsons_logo.jpeg",
    shortcut: "/omsons_logo.jpeg",
    apple: "/omsons_logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ReactQueryProvider>
          <DealerTermsGate />
          {children}
        </ReactQueryProvider>
      </body>
    </html>
  );
}
