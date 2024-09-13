import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";

import "./globals.css";
import SessionProvider from "../components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Social Media",
  description: "Generated by create next app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  return (
    <SessionProvider session={session}>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </SessionProvider>
  );
}
