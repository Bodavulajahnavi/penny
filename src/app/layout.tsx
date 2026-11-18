import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "./globals.css";
export const metadata: Metadata = {
  title: "penny — A little clarity for your money",
  description:
    "Your everyday finances, thoughtfully brought together. Track income and expenses, build monthly budgets, and make room for what matters.",
  applicationName: "penny",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
