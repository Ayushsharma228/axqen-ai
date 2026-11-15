import { Sprout, Store, ShoppingBag, Layers, TrendingUp, ArrowRight, type LucideIcon } from "lucide-react";
import { C } from "./constants";
import { AUDIENCES } from "./content";

// Icons follow AUDIENCES order.
const ICONS: LucideIcon[] = [Sprout, Store, ShoppingBag, Layers, TrendingUp];

export function Testimonials() {
  return (
    <section id="audience" className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.card }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
          <div className="lg:w-[340px] flex-shrink-0 lg:sticky lg:top-28">
            <p className="axq-eyebrow mb-4">Who AXQEN is for</p>
            <h2 className="text-3xl md:text-[44px] mb-5 leading-tight" style={{ color: C.heading, textWrap: "balance" }}>
              Built for wherever you are in the journey.
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: C.body }}>
              From your first product to a multi-channel brand, the same operating system grows with you.
            </p>
            <a href="/dropshipping" className="inline-flex items-center gap-1.5 text-[15px] font-semibold py-2" style={{ color: C.action }}>
              Starting with dropshipping? See AXQEN as your dropshipping provider
              <ArrowRight size={16} aria-hidden />
            </a>
          </div>

          <ul className="flex-1 w-full flex flex-col gap-3">
            {AUDIENCES.map((a, i) => {
              const Icon = ICONS[i] ?? Store;
              return (
                <li key={a.title} className="axq-card axq-card-hover flex items-center gap-5 px-6 py-5">
                  <span className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.paleLilac }}>
                    <Icon size={22} color={C.action} aria-hidden />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg leading-tight" style={{ color: C.heading, letterSpacing: "-0.02em" }}>{a.title}</h3>
                    <p className="text-[15px] mt-1" style={{ color: C.body }}>{a.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
