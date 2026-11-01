import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/features/auth/auth-context";
import { RestaurantProvider } from "@/features/restaurants/restaurant-context";
import { SITE_DESCRIPTION, SITE_LOGO, SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

// The interface font (a variable font, weights 200-800). Geist Mono stays for
// codes and technical references.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "en_IN",
    images: [{ url: SITE_LOGO, width: 1953, height: 493, alt: "Foodi" }],
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_LOGO],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <RestaurantProvider>{children}</RestaurantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
