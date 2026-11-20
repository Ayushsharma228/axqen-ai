
import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

// Fonts are self-hosted (src/fonts) so builds never depend on downloading from Google Fonts.
const inter = localFont({
  src: "../fonts/inter.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const playfair = localFont({
  src: [
    { path: "../fonts/playfair.woff2", weight: "400 900", style: "normal" },
    { path: "../fonts/playfair-italic.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-playfair",
  display: "swap",
  preload: false,
});

// Monospace for codes and IDs in the dashboards (order IDs, AWBs, SKUs). UI text uses Inter.
const plexMono = localFont({
  src: [
    { path: "../fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/plex-mono-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/plex-mono-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono", display: "swap", preload: false,
});

const spaceGrotesk = localFont({
  src: "../fonts/space-grotesk.woff2",
  variable: "--font-space",
  weight: "300 700",
  display: "swap",
  preload: false,
});


export const metadata: Metadata = {
  metadataBase: new URL("https://www.axqen.app"),

  title: {
    default: "AXQEN AI | AI Commerce Operating System",
    template: "%s | AXQEN AI",
  },

  description:
    "AXQEN AI is an AI Commerce Operating System that helps ecommerce brands, sellers, and agencies streamline product listings, inventory, supplier coordination, order processing, and fulfilment through one platform.",

  applicationName: "AXQEN AI",

  openGraph: {
    type: "website",
    url: "https://www.axqen.app/",
    siteName: "AXQEN AI",
    title: "AXQEN AI | AI Commerce Operating System",
    description:
      "Streamline ecommerce operations with AXQEN AI, from product listings and inventory to supplier coordination and order fulfilment.",
  },

  icons: {
    icon: "/axqen-icon.png",
  },
};

// Google site name structured data
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AXQEN AI",
  alternateName: "AXQEN",
  url: "https://www.axqen.app/",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />

        {/* Pixel calls queue immediately; the heavy fbevents.js loads on first interaction or after 6s so it doesn't block page load. */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];
            var done=false,evs=['scroll','pointerdown','keydown','touchstart'];
            function load(){if(done)return;done=true;
              evs.forEach(function(x){f.removeEventListener(x,load)});
              t=b.createElement(e);t.async=!0;t.src=v;
              s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
            evs.forEach(function(x){f.addEventListener(x,load,{once:true,passive:true})});
            setTimeout(load,6000)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1376373393780720');
            fbq('track', 'PageView');
          `}
        </Script>
      </head>

      <body
        className="min-h-full"
        style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        }}
      >
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1376373393780720&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
