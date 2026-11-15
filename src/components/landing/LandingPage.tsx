import { Navbar }           from "./Navbar";
import { Hero }             from "./Hero";
import { StatsBar }         from "./StatsBar";
import { Features }         from "./Features";
import { HowItWorks }       from "./HowItWorks";
import { ProductCatalogue } from "./ProductCatalogue";
import { Testimonials }     from "./Testimonials";
import { Results }          from "./Results";
import { Plans }            from "./Plans";
import { FAQ }              from "./FAQ";
import { FinalCTA }         from "./FinalCTA";
import { Footer }           from "./Footer";
import { AXQ_ROOT }         from "./theme";

export default function LandingPage() {
  return (
    <div className={AXQ_ROOT} style={{ minHeight: "100vh" }}>
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>
      <main>
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <ProductCatalogue />
        <Testimonials />
        <Results />
        <Plans />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
