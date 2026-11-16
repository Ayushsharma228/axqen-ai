import { Check } from "lucide-react";
import { C } from "@/components/landing/constants";
import { isPublished } from "../posts";

/** Links to another post only once that post is published; until then renders the anchor text plainly (no 404s). */
export function PostLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  if (!isPublished(slug)) return <>{children}</>;
  return <a href={`/blog/${slug}`}>{children}</a>;
}

/** External source. With no href yet it renders as plain text. */
export function Source({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function Table({ head, rows, total }: { head: string[]; rows: React.ReactNode[][]; total?: React.ReactNode[] }) {
  return (
    <div className="axq-table-wrap">
      <table>
        <thead>
          <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
          {total && (
            <tr className="axq-total">{total.map((c, j) => <td key={j}>{c}</td>)}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="axq-checklist">
      {items.map((t) => (
        <li key={t}>
          <span aria-hidden className="axq-check"><Check size={13} strokeWidth={3} color={C.action} /></span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function Cta({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`axq-cta ${compact ? "axq-cta-compact" : ""}`}>
      <div>
        <p className="axq-cta-title">Start with the right system.</p>
        <p className="axq-cta-sub">
          Get started with AXQEN AI and run your store, orders, shipping and profit from one dashboard.
        </p>
      </div>
      <a href="/" className="axq-btn axq-btn-lime">Get Started with AXQEN AI →</a>
    </aside>
  );
}
