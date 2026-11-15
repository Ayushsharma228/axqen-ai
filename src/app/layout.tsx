
import type { Metadata } from "next";
import { Inter, Playfair_Display, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  style: ["normal", "italic"],
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${inter.variable} ${playfair.variable} ${spaceGrotesk.variable} h-full antialiased`}
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
