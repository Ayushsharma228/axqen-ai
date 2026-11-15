import { Outfit, Figtree } from "next/font/google";
import "./landing.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-outfit", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree", display: "swap" });

export const AXQ_ROOT = `axq ${outfit.variable} ${figtree.variable}`;
