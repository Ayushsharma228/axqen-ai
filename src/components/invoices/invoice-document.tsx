// Tally-style tax invoice (matches the format Vrinandya's CA uses). Pure presentational; print-ready on A4.
import { amountInWords, r2, type InvoiceBuyer, type InvoiceLine, type InvoiceSettings } from "@/lib/invoice-format";

export interface InvoiceDoc {
  id: string; number: string | null; status: string; cancelReason?: string | null;
  issueDate: string | Date | null; orderNumber: string | null; placeOfSupply: string | null;
  buyer: unknown; lines: unknown;
  taxableTotal: number; cgst: number; sgst: number; igst: number; total: number;
}

const money = (n: number) => r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tallyDate = (d: string | Date | null) => {
  if (!d) return "";
  const x = new Date(d);
  const ist = new Date(x.getTime() + 5.5 * 3600000);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][ist.getUTCMonth()];
  return `${ist.getUTCDate()}-${mon}-${String(ist.getUTCFullYear()).slice(2)}`;
};

const B = "1px solid #000";
const cell: React.CSSProperties = { borderRight: B, padding: "2px 4px", verticalAlign: "top" };

export function InvoiceDocument({ inv, settings }: { inv: InvoiceDoc; settings: InvoiceSettings }) {
  const buyer = (inv.buyer ?? {}) as InvoiceBuyer;
  const lines = (Array.isArray(inv.lines) ? inv.lines : []) as InvoiceLine[];
  const intra = inv.cgst > 0 || inv.sgst > 0;
  const taxTotal = r2(inv.cgst + inv.sgst + inv.igst);
  const c = settings.company;
  const qtyPcs = lines.filter(l => l.unit === "Pcs").reduce((s, l) => s + l.qty, 0);

  // HSN/SAC summary: group by code + rate
  const groups = new Map<string, { hsn: string; rate: number; taxable: number; tax: number }>();
  for (const l of lines) {
    const k = `${l.hsn}|${l.gstRate}`;
    const g = groups.get(k) ?? { hsn: l.hsn, rate: l.gstRate, taxable: 0, tax: 0 };
    g.taxable = r2(g.taxable + l.taxable); g.tax = r2(g.tax + l.tax);
    groups.set(k, g);
  }
  const summary = [...groups.values()];

  return (
    <div className="invoice-page" style={{ position: "relative", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 11, color: "#000", background: "#fff", width: "190mm", margin: "0 auto" }}>
      {inv.status === "CANCELLED" && (
        <div style={{ position: "absolute", top: "38%", left: 0, right: 0, textAlign: "center", fontSize: 72, fontWeight: 800, color: "rgba(220,38,38,0.18)", transform: "rotate(-24deg)", pointerEvents: "none" }}>
          CANCELLED
        </div>
      )}
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Tax Invoice</div>

      <table style={{ width: "100%", borderCollapse: "collapse", border: B }}>
        <tbody>
          <tr>
            {/* Seller + buyer */}
            <td style={{ width: "50%", borderRight: B, padding: 0, verticalAlign: "top" }}>
              <div style={{ padding: "4px 5px", borderBottom: B }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{c.name}</div>
                {c.addressLines.map(l => <div key={l}>{l}</div>)}
                <div>GSTIN/UIN: {c.gstin}</div>
                {c.cin && <div>CIN: {c.cin}</div>}
                <div>State Name : {c.stateName}, Code : {c.stateCode}</div>
                <div>E-Mail : {c.email}</div>
              </div>
              <div style={{ padding: "4px 5px" }}>
                <div style={{ fontSize: 10 }}>Buyer (Bill to)</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{buyer.name}</div>
                {(buyer.addressLines ?? []).map(l => <div key={l}>{l}</div>)}
                {buyer.gstin && <div>GSTIN/UIN : {buyer.gstin}</div>}
                <div>State Name : {buyer.stateName}, Code : {buyer.stateCode}</div>
              </div>
            </td>
            {/* Invoice meta */}
            <td style={{ width: "50%", padding: 0, verticalAlign: "top" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    [["Invoice No.", inv.number ?? ""], ["Dated", tallyDate(inv.issueDate)]],
                    [["Buyer's Order No.", inv.orderNumber ? (inv.orderNumber.startsWith("#") ? inv.orderNumber : `#${inv.orderNumber}`) : ""], ["Mode/Terms of Payment", "Adjusted against payout"]],
                    [["Place of Supply", inv.placeOfSupply ?? ""], ["Reverse Charge", "No"]],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map(([k, v], j) => (
                        <td key={k} style={{ width: "50%", borderBottom: B, borderRight: j === 0 ? B : undefined, padding: "3px 5px", height: 32, verticalAlign: "top" }}>
                          <div style={{ fontSize: 10 }}>{k}</div>
                          <div style={{ fontWeight: 700 }}>{v}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ padding: "3px 5px", height: 44, verticalAlign: "top" }}>
                      <div style={{ fontSize: 10 }}>Terms of Delivery</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: B, borderTop: "none" }}>
        <thead>
          <tr style={{ borderBottom: B, fontSize: 10 }}>
            {["Sl No.", "Description of Goods and Services", "HSN/SAC", "GST Rate", "Quantity", "Rate", "per", "Amount"].map((h, i) => (
              <th key={h} style={{ ...cell, borderRight: i === 7 ? "none" : B, fontWeight: 400, textAlign: i === 1 ? "center" : i >= 4 ? "right" : "center", width: [26, undefined, 62, 44, 62, 62, 30, 82][i] }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
              <td style={{ ...cell, fontWeight: 700 }}>{l.description}</td>
              <td style={cell}>{l.hsn}</td>
              <td style={{ ...cell, textAlign: "right" }}>{l.gstRate} %</td>
              <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{l.qty} {l.unit}</td>
              <td style={{ ...cell, textAlign: "right" }}>{money(l.rate)}</td>
              <td style={cell}>{l.unit}</td>
              <td style={{ ...cell, borderRight: "none", textAlign: "right", fontWeight: 700 }}>{money(l.taxable)}</td>
            </tr>
          ))}
          {(intra ? [["Output CGST", inv.cgst], ["Output SGST", inv.sgst]] : [["Output IGST", inv.igst]]).map(([label, amt]) => (
            <tr key={String(label)}>
              <td style={cell} />
              <td style={{ ...cell, textAlign: "right", fontStyle: "italic", fontWeight: 700, paddingTop: 8 }}>{label}</td>
              <td style={cell} /><td style={cell} /><td style={cell} /><td style={cell} /><td style={cell} />
              <td style={{ ...cell, borderRight: "none", textAlign: "right", fontWeight: 700, paddingTop: 8 }}>{money(Number(amt))}</td>
            </tr>
          ))}
          {/* filler so the table keeps the Tally proportions */}
          <tr style={{ height: Math.max(40, 220 - lines.length * 22) }}>
            {Array.from({ length: 8 }, (_, i) => <td key={i} style={{ ...cell, borderRight: i === 7 ? "none" : B }} />)}
          </tr>
          <tr style={{ borderTop: B }}>
            <td style={cell} />
            <td style={{ ...cell, textAlign: "right" }}>Total</td>
            <td style={cell} /><td style={cell} />
            <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{qtyPcs ? `${qtyPcs} Pcs` : ""}</td>
            <td style={cell} /><td style={cell} />
            <td style={{ ...cell, borderRight: "none", textAlign: "right", fontWeight: 800, fontSize: 13 }}>₹ {money(inv.total)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words */}
      <div style={{ border: B, borderTop: "none", padding: "3px 5px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span>Amount Chargeable (in words)</span><span style={{ fontStyle: "italic" }}>E. &amp; O.E</span></div>
        <div style={{ fontWeight: 700, fontSize: 12 }}>{amountInWords(inv.total)}</div>
      </div>

      {/* HSN summary */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: B, borderTop: "none", fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: B }}>
            <th rowSpan={2} style={{ ...cell, fontWeight: 400 }}>HSN/SAC</th>
            <th rowSpan={2} style={{ ...cell, fontWeight: 400, textAlign: "right", width: 78 }}>Taxable Value</th>
            {intra ? (<>
              <th colSpan={2} style={{ ...cell, fontWeight: 400, borderBottom: B }}>CGST</th>
              <th colSpan={2} style={{ ...cell, fontWeight: 400, borderBottom: B }}>SGST/UTGST</th>
            </>) : (
              <th colSpan={2} style={{ ...cell, fontWeight: 400, borderBottom: B }}>IGST</th>
            )}
            <th rowSpan={2} style={{ ...cell, borderRight: "none", fontWeight: 400, textAlign: "right", width: 78 }}>Total Tax Amount</th>
          </tr>
          <tr style={{ borderBottom: B }}>
            {(intra ? ["Rate", "Amount", "Rate", "Amount"] : ["Rate", "Amount"]).map((h, i) => (
              <th key={i} style={{ ...cell, fontWeight: 400, textAlign: "right", width: 54 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.map(g => {
            const half = r2(g.tax / 2);
            return (
              <tr key={`${g.hsn}${g.rate}`}>
                <td style={cell}>{g.hsn}</td>
                <td style={{ ...cell, textAlign: "right" }}>{money(g.taxable)}</td>
                {intra ? (<>
                  <td style={{ ...cell, textAlign: "right" }}>{g.rate / 2}%</td><td style={{ ...cell, textAlign: "right" }}>{money(half)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{g.rate / 2}%</td><td style={{ ...cell, textAlign: "right" }}>{money(r2(g.tax - half))}</td>
                </>) : (<>
                  <td style={{ ...cell, textAlign: "right" }}>{g.rate}%</td><td style={{ ...cell, textAlign: "right" }}>{money(g.tax)}</td>
                </>)}
                <td style={{ ...cell, borderRight: "none", textAlign: "right" }}>{money(g.tax)}</td>
              </tr>
            );
          })}
          <tr style={{ borderTop: B, fontWeight: 700 }}>
            <td style={{ ...cell, textAlign: "right" }}>Total</td>
            <td style={{ ...cell, textAlign: "right" }}>{money(inv.taxableTotal)}</td>
            {intra ? (<>
              <td style={cell} /><td style={{ ...cell, textAlign: "right" }}>{money(inv.cgst)}</td>
              <td style={cell} /><td style={{ ...cell, textAlign: "right" }}>{money(inv.sgst)}</td>
            </>) : (<>
              <td style={cell} /><td style={{ ...cell, textAlign: "right" }}>{money(inv.igst)}</td>
            </>)}
            <td style={{ ...cell, borderRight: "none", textAlign: "right" }}>{money(taxTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Footer: tax in words, bank, declaration, signatory */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: B, borderTop: "none" }}>
        <tbody>
          <tr>
            <td colSpan={2} style={{ padding: "4px 5px" }}>
              <span style={{ fontSize: 10 }}>Tax Amount (in words) : </span>
              <b style={{ fontSize: 12 }}>{taxTotal > 0 ? amountInWords(taxTotal) : "NIL"}</b>
            </td>
          </tr>
          <tr>
            <td style={{ width: "50%" }} />
            <td style={{ width: "50%", padding: "2px 5px 6px" }}>
              <div>Company&apos;s Bank Details</div>
              <div>A/c Holder&apos;s Name : <b>{settings.bank.holder}</b></div>
              <div>Bank Name : <b>{settings.bank.bankName}</b></div>
              <div>A/c No. : <b>{settings.bank.account}</b></div>
              <div>Branch &amp; IFS Code: <b>{settings.bank.branchIfsc}</b></div>
              <div>SWIFT Code : {settings.bank.swift}</div>
            </td>
          </tr>
          <tr style={{ borderTop: B }}>
            <td style={{ width: "50%", borderRight: B, padding: "3px 5px", verticalAlign: "bottom", fontSize: 10 }}>
              <div style={{ textDecoration: "underline" }}>Declaration</div>
              <div>{settings.declaration}</div>
            </td>
            <td style={{ width: "50%", padding: "3px 5px", height: 64, verticalAlign: "top" }}>
              <div style={{ textAlign: "right", fontWeight: 700 }}>for {c.name}</div>
              <div style={{ textAlign: "right", marginTop: 34, fontSize: 10 }}>Authorised Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: "center", fontSize: 10, marginTop: 4 }}>This is a Computer Generated Invoice</div>
      {inv.status === "CANCELLED" && inv.cancelReason && (
        <div style={{ textAlign: "center", fontSize: 10, marginTop: 2, color: "#B91C1C" }}>Cancelled: {inv.cancelReason}</div>
      )}
    </div>
  );
}
