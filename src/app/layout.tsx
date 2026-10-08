import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { config } from "@/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const description = `${config.tagline} · ${config.location}`;

export const metadata: Metadata = {
  title: config.partyName,
  description,
  applicationName: config.partyName,
  // What shows when the link is texted or pasted into a chat.
  openGraph: {
    type: "website",
    siteName: config.partyName,
    title: config.partyName,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: config.partyName }],
  },
  twitter: { card: "summary_large_image", title: config.partyName, description, images: ["/og.png"] },
  // Lets iOS open the home-screen icon full screen, without Safari's bars.
  appleWebApp: {
    capable: true,
    title: config.shortName,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // A private party app has no business in search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: config.brand.canvas,
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
