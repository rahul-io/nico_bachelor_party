import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Playfair_Display } from "next/font/google";
import { config } from "@/config";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: "italic",
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
  // The header is navy in both day and night mode.
  themeColor: config.brand.chrome,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets data-theme before React loads, so the attribute differs from the server's.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
