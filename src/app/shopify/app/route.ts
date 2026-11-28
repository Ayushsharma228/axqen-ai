import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, getPendingInstall, installAuthorizeUrl, normalizeShopDomain, signClaim, topLevelRedirectResponse, verifyOAuthHmac } from "@/lib/shopify";

// The AXQEN AI page inside the merchant's Shopify admin (embedded app). Served as plain HTML so the
// App Bridge script is the first script on the page, as Shopify requires.
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Refreshes the page's status from AXQEN using an App Bridge session token (Authorization: Bearer <JWT>).
// While a store is waiting to be linked, it checks every few seconds and reloads once the seller has logged in.
const LIVE_SCRIPT = `
// Links to AXQEN open in the whole browser window (target=_top / App Bridge), because new tabs are blocked
// in the admin's sandboxed frame. After logging in, AXQEN shows a 'Back to Shopify admin' button.
document.querySelectorAll("a[data-open]").forEach(function (a) {
  a.addEventListener("click", function (e) {
    if (!window.shopify) return; // not inside the admin: the normal link works
    e.preventDefault();
    window.open(a.href, "_top"); // App Bridge moves the whole window to AXQEN (new tabs are blocked in the admin frame)
  });
});
// Log in inside the admin: the session token proves the store, the password proves the AXQEN account.
var form = document.getElementById("link-form");
if (form) form.addEventListener("submit", async function (e) {
  e.preventDefault();
  var btn = document.getElementById("link-submit"), err = document.getElementById("link-error");
  err.hidden = true; btn.disabled = true; btn.textContent = "Connecting…";
  try {
    if (!window.shopify || !shopify.idToken) throw new Error("Open AXQEN AI from your Shopify admin and try again.");
    var token = await shopify.idToken();
    var r = await fetch("/api/shopify/link", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ email: form.email.value, password: form.password.value }),
    });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || "Couldn't connect. Try again.");
    location.reload();
  } catch (x) {
    err.textContent = x.message; err.hidden = false;
    btn.disabled = false; btn.textContent = "Connect to my AXQEN account";
  }
});
(async function () {
  async function status() {
    if (!window.shopify || !shopify.idToken) return null;
    const token = await shopify.idToken();
    const r = await fetch("/api/shopify/status", { headers: { Authorization: "Bearer " + token } });
    return r.ok ? r.json() : null;
  }
  const waiting = !document.getElementById("live-orders");
  for (let i = 0; i < (waiting ? 60 : 1); i++) {
    try {
      const s = await status();
      if (s && waiting && s.connected) { location.reload(); return; }
      if (s && !waiting && s.connected) {
        document.getElementById("live-orders").textContent = String(s.orders);
        const el = document.getElementById("live-status");
        const p = document.createElement("p");
        p.className = s.lastSyncError ? "warn" : "ok";
        p.textContent = s.lastSyncError || ("Orders sync automatically every hour" + (s.lastSyncAt ? ". Last synced " + new Date(s.lastSyncAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "") + ".");
        el.replaceChildren(p);
      }
    } catch (e) { /* keep the server-rendered status */ }
    if (waiting) await new Promise(r => setTimeout(r, 5000));
  }
})();
`;

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const shop = normalizeShopDomain(sp.get("shop"));
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  if (!shop || !secret || !verifyOAuthHmac(sp, secret)) {
    return new NextResponse("Open AXQEN AI from your Shopify admin.", { status: 400 });
  }

  const store = await prisma.shopifyStore.findFirst({
    where: { storeUrl: shop },
    select: { storeName: true, lastSyncAt: true, lastSyncError: true, clientId: true, accessTokenExpiresAt: true, seller: { select: { brandName: true, name: true, email: true } } },
  });
  // Not connected through the AXQEN AI app (or uninstalled and reopened): authenticate first.
  const pending = store ? null : await getPendingInstall(shop);
  if (!store && !pending) return topLevelRedirectResponse(shop, installAuthorizeUrl(shop));

  const base = appUrl();
  let body: string;
  if (store) {
    const who = store.seller.brandName || store.seller.name || store.seller.email;
    const orders = await prisma.order.count({ where: { source: "SHOPIFY", seller: { shopifyStore: { storeUrl: shop } } } }).catch(() => 0);
    const status = store.lastSyncError
      ? `<p class="warn">${esc(store.lastSyncError)}</p>`
      : `<p class="ok">Orders sync automatically every hour${store.lastSyncAt ? `. Last synced ${esc(when(store.lastSyncAt))}` : ""}.</p>`;
    body = `
      <p class="eyebrow">Connected</p>
      <h1>${esc(store.storeName)} is connected to AXQEN</h1>
      <p>AXQEN account: <b>${esc(who)}</b></p>
      <div id="live-status">${status}</div>
      <div class="stats"><div><span id="live-orders">${orders}</span>Shopify orders in AXQEN</div></div>
      <p>Order confirmation calls, shipping, NDR and returns, payouts and profit reports are run from your AXQEN dashboard.</p>
      <a class="btn" data-open href="${base}/seller" target="_top">Open AXQEN dashboard</a>
      <a class="link" data-open href="${base}/seller/shopify" target="_top">Store connection settings</a>`;
  } else {
    const claimUrl = `${base}/seller/shopify?claim=${encodeURIComponent(signClaim(shop))}`;
    body = `
      <p class="eyebrow">One more step</p>
      <h1>Finish connecting ${esc(pending!.storeName)} to AXQEN</h1>
      <p>Shopify has approved AXQEN AI for your store. Log in with your AXQEN seller account to link this store to it.</p>
      <form id="link-form" class="form" autocomplete="on">
        <label for="link-email">AXQEN email</label>
        <input id="link-email" name="email" type="email" autocomplete="username" required>
        <label for="link-password">Password</label>
        <input id="link-password" name="password" type="password" autocomplete="current-password" required>
        <p id="link-error" class="err" role="alert" hidden></p>
        <button id="link-submit" class="btn" type="submit">Connect to my AXQEN account</button>
      </form>
      <p class="muted">New to AXQEN? Create an account at <b>www.axqen.app/signup</b>, then come back here and log in.</p>
      <p class="muted">Prefer the website? Open this link in your browser: <span class="copy">${esc(claimUrl)}</span></p>
      <p class="muted">Need help? Write to connect@vrinandyaventures.in</p>`;
  }

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="shopify-api-key" content="${esc(process.env.SHOPIFY_API_KEY ?? "")}">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<title>AXQEN AI</title>
<style>
  :root { --ink:#0F1729; --muted:#4A5568; --blue:#1D5CFF; --line:#E3E8F2; --bg:#F4F6FB; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter,-apple-system,"Segoe UI",Arial,sans-serif; padding:24px 16px; }
  main { max-width:640px; margin:0 auto; background:#FBFCFF; border:1px solid var(--line); border-radius:16px; padding:28px; display:flex; flex-direction:column; gap:12px; }
  .eyebrow { font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--blue); margin:0; }
  h1 { font-size:22px; line-height:1.25; margin:0; text-wrap:balance; }
  p { font-size:14px; line-height:1.55; color:var(--muted); margin:0; }
  .ok { color:#047857; } .warn { color:#B45309; background:#FFFBEB; padding:10px 12px; border-radius:10px; }
  .muted { font-size:12px; color:#8A94A8; }
  .form { display:flex; flex-direction:column; gap:6px; margin-top:4px; }
  .form label { font-size:13px; font-weight:600; color:var(--ink); margin-top:6px; }
  .form input { font:inherit; font-size:14px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:#fff; color:var(--ink); }
  .form input:focus-visible { outline:2px solid var(--blue); outline-offset:1px; border-color:var(--blue); }
  .form button { border:0; cursor:pointer; margin-top:10px; }
  .form button:disabled { opacity:.6; cursor:default; }
  .err { color:#B91C1C; background:#FEF2F2; padding:10px 12px; border-radius:10px; font-size:13px; }
  .stats div { display:inline-flex; flex-direction:column; font-size:12px; color:var(--muted); background:#F0F4FF; border-radius:10px; padding:10px 14px; }
  .stats span { font-size:22px; font-weight:800; color:var(--ink); }
  .btn { display:inline-block; align-self:flex-start; background:var(--blue); color:#fff; font-weight:700; font-size:14px; text-decoration:none; padding:11px 18px; border-radius:10px; margin-top:6px; }
  .btn:focus-visible, .link:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
  .link { font-size:13px; color:var(--blue); font-weight:600; }
  .copy { display:block; margin-top:4px; padding:8px 10px; background:#EEF2FB; border-radius:8px; font-family:ui-monospace,Consolas,monospace; font-size:11px; color:#0F1729; word-break:break-all; user-select:all; }
</style>
</head><body><main>${body}</main>
<script>${LIVE_SCRIPT}</script>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `frame-ancestors https://${shop} https://admin.shopify.com;`,
    },
  });
}
