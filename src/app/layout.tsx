import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const description = "Chat with your style fairy, browse suggestions from real shops, and see every piece in your closet.";

export const metadata: Metadata = {
  title: { template: "%s — dripy.", default: "dripy. — Your closet, with a fairy" },
  description,
  openGraph: { title: "dripy. — Your closet, with a fairy", description, type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${manrope.variable}`}>
      <body>
        <div className="theme-muse flex h-dvh flex-col overflow-hidden bg-background font-body text-foreground">
          {children}
        </div>
      </body>
    </html>
  );
}
