import { Store, Boxes, ClipboardList, Truck, RotateCcw, Wallet, ChartColumn, type LucideIcon } from "lucide-react";
import { C } from "./constants";
import { CAPABILITIES, CAPABILITIES_HEADING } from "./content";

// Icons follow CAPABILITIES order.
const ICONS: LucideIcon[] = [Store, Boxes, ClipboardList, Truck, RotateCcw, Wallet, ChartColumn];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.navy }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {/* Heading occupies the first cell so 7 capabilities fill an even grid */}
          <div
            className="rounded-2xl p-7 flex flex-col justify-end min-h-[220px] relative overflow-hidden"
            style={{ background: `linear-gradient(150deg, ${C.violet} 0%, ${C.deep} 100%)` }}
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none" style={{ background: "rgba(158,194,255,0.35)", filter: "blur(30px)" }} />
            <p className="axq-eyebrow mb-3 relative" style={{ color: C.lime }}>Platform capabilities</p>
            <h2 className="text-[26px] leading-[1.12] text-white relative" style={{ textWrap: "balance" }}>
              {CAPABILITIES_HEADING}
            </h2>
          </div>
          {CAPABILITIES.map((f, i) => {
            const Icon = ICONS[i] ?? Store;
            return (
              <div key={f.title} className="axq-card axq-card-hover p-7">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-6" style={{ background: C.paleLilac }}>
                  <Icon size={22} strokeWidth={2} color={C.action} aria-hidden />
                </span>
                <h3 className="text-lg mb-2 leading-snug" style={{ color: C.heading, letterSpacing: "-0.02em" }}>{f.title}</h3>
                <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
