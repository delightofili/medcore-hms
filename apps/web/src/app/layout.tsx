import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "MedCore HMS",
  description: "Hospital Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
