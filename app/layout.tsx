import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import ConditionalLayout from "@/components/layout/ConditionalLayout";
import { ACADEMY } from "@/lib/constants";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: {
    default: ACADEMY.name,
    template: `%s | ${ACADEMY.name}`,
  },
  description: "منصة أكاديمية هيثم التعليمية - دورات تعليمية احترافية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full scroll-smooth`}>
      <body className="flex min-h-full flex-col antialiased">
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
