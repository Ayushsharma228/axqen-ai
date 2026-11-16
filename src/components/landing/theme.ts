import localFont from "next/font/local";
import "./landing.css";

const outfit = localFont({ src: "../../fonts/outfit.woff2", weight: "100 900", variable: "--font-outfit", display: "swap" });
const figtree = localFont({ src: "../../fonts/figtree.woff2", weight: "300 900", variable: "--font-figtree", display: "swap" });

export const AXQ_ROOT = `axq ${outfit.variable} ${figtree.variable}`;
