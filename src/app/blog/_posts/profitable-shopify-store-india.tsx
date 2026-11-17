import { PostLink, Source, Table, Checklist, Cta } from "../_components/Prose";
import { getPost, SOURCES } from "../posts";

export default function ProfitableShopifyStoreIndia() {
  const faqs = getPost("profitable-shopify-store-india")?.faqs ?? [];

  return (
    <>
      <p>
        A profitable Shopify store in India is built on unit economics, not on design. Themes, apps and logos matter
        less than four numbers: what the product costs you, what it costs to ship, how many orders come back, and
        what you pay to win each customer.
      </p>
      <p>
        This guide covers the build in the order that protects those numbers: price first, then setup, then
        operations, then launch.
      </p>

      <h2 id="pricing">Price the product before you build anything</h2>
      <p>
        Most new stores set a price by looking at competitors. That tells you what customers will pay. It does not
        tell you whether you will make money. Work out your break-even ad cost first.
      </p>
      <p className="axq-formula">
        <strong>
          Break-even ad cost per order = (Revenue from delivered orders − all non-ad costs) ÷ total orders placed
        </strong>
      </p>
      <p>
        Here is the calculation for 100 orders at three price points. The inputs are illustrative assumptions: product
        cost ₹250, forward shipping ₹70 per order, COD handling fee ₹35 per delivered COD order, gateway fee 2% on
        prepaid, return shipping ₹60 per RTO, 60 COD and 40 prepaid orders, RTO of 30% on COD and 5% on prepaid. That
        gives 80 delivered orders and 20 returns.
      </p>
      <Table
        head={["Selling price", "Revenue (80 delivered)", "Non-ad costs", "Left before ads", "Break-even ad cost per order"]}
        rows={[
          ["₹699", "₹55,920", "₹30,201", "₹25,719", "₹257"],
          ["₹799", "₹63,920", "₹30,277", "₹33,643", "₹336"],
          ["₹899", "₹71,920", "₹30,353", "₹41,567", "₹416"],
        ]}
      />
      <p>
        Read the last column as a ceiling. At ₹799, if your ads cost ₹336 per order you earn nothing. At ₹150 per
        order you keep ₹186 per order. A ₹100 price difference moves your ceiling by about ₹80, which is often the gap
        between a product that scales and one that does not.
      </p>
      <p>
        If your ad cost in testing sits above the ceiling, you have three levers: raise the price, cut the product
        cost, or reduce RTO. Better ad creative alone rarely closes a large gap. The same unit economics method is
        explained step by step in our{" "}
        <PostLink slug="start-dropshipping-business-india">guide to starting a dropshipping business in India</PostLink>.
      </p>
      <Cta compact />

      <h2 id="setup">Shopify setup walkthrough</h2>
      <p>Work through these in order. Each step depends on the one before it.</p>
      <ol>
        <li><strong>Create the store and pick a theme.</strong> Start with a free, fast theme. Speed and clarity on mobile matter more than visual effects.</li>
        <li><strong>Add your products.</strong> For each one: a benefit-led title, 4 to 6 real photos, a short description that answers the buyer&rsquo;s main doubt, price, compare-at price if genuine, and weight for shipping.</li>
        <li><strong>Organise collections and navigation.</strong> Group products the way a shopper would look for them. Keep the main menu to five items or fewer.</li>
        <li><strong>Set up payments.</strong> Connect a payment gateway that supports UPI, cards and wallets, and enable cash on delivery as a payment method.</li>
        <li><strong>Configure shipping.</strong> Define the zones you serve and your shipping rates. Free shipping above a threshold can lift order value, but only if your margin calculation already includes the shipping cost.</li>
        <li><strong>Check tax settings.</strong> Set up taxes according to your registration. Confirm the configuration with your CA.</li>
        <li><strong>Publish policy pages.</strong> Shipping, returns and refunds, privacy and terms. Payment gateways and ad platforms review these before approving your account.</li>
        <li><strong>Connect your domain.</strong> A custom domain builds more trust than a default store address.</li>
        <li><strong>Place a test order</strong> for both COD and prepaid. Check the confirmation message, the order in your admin and the handoff to your courier or supplier.</li>
        <li><strong>Remove the store password</strong> and go live.</li>
      </ol>

      <h2 id="product-page">Build a product page that converts</h2>
      <p>A shopper on a phone decides in a few seconds. Above the fold, show:</p>
      <ul>
        <li>What the product is and the main benefit</li>
        <li>Price and any genuine offer</li>
        <li>Estimated delivery time for their pin code or city</li>
        <li>COD and prepaid availability</li>
        <li>Return policy in one line</li>
      </ul>
      <p>
        Below that, add photos of the product in use, answers to common questions and reviews as you collect them. Do
        not invent reviews. A new store with honest photos and clear policies converts better than one that looks
        fake.
      </p>

      <h2 id="payments">Set up payments for the Indian buyer</h2>
      <p>
        COD is still how a large share of India shops. Around 60 to 65% of e-commerce orders are placed as COD, per ET
        Prime Research (2024) as cited by <Source href={SOURCES.razorpay}>Razorpay</Source>. Removing COD usually costs
        sales, so shape it instead:
      </p>
      <ul>
        <li>Offer a small prepaid discount at checkout</li>
        <li>Offer partial COD, where a small advance is paid online</li>
        <li>Restrict COD above a set order value</li>
        <li>Confirm every COD order before dispatch</li>
      </ul>
      <p>
        Our comparison of <PostLink slug="prepaid-vs-cod-orders-india">prepaid vs COD orders</PostLink> shows the
        profit difference on 100 orders of each.
      </p>

      <h2 id="shipping">Choose shipping with returns in mind</h2>
      <p>
        Judge a courier partner on delivery success, not on the cheapest rate card. Ask about pin code coverage, COD
        remittance cycle, and how fast non-delivery reports (NDRs) reach you. A slow NDR process turns a recoverable
        order into an RTO.
      </p>
      <p>
        On ClickPost&rsquo;s FY2026 D2C network, COD orders ended as RTO at 37.51% against 5.28% for prepaid (
        <Source href={SOURCES.clickpost}>ClickPost</Source>). Benchmarks vary by source and category, so measure your
        own rate from the first week.
      </p>

      <h2 id="launch-checklist">Launch checklist</h2>
      <Checklist
        items={[
          "Break-even ad cost calculated for every product",
          "Product pages checked on a phone",
          "COD and prepaid test orders completed",
          "Order confirmation message working",
          "Courier connected and a test shipment booked",
          "Shipping, returns, privacy and terms pages published",
          "Contact details and business name visible in the footer",
          "Analytics and ad tracking installed and tested",
          "Supplier knows the dispatch process and timelines",
          "A process exists for NDR follow-up and RTO recording",
        ]}
      />

      <h2 id="metrics">Measure what matters after launch</h2>
      <p>Shopify shows you sales. Profit needs more inputs. Review these weekly:</p>
      <Table
        head={["Metric", "How to calculate", "Why it matters"]}
        rows={[
          ["Delivery rate", "Delivered orders ÷ shipped orders", "Shows how much of your revenue is real"],
          ["RTO rate by payment mode", "RTO orders ÷ shipped orders, split COD and prepaid", "Shows where returns come from"],
          ["Ad cost per order", "Ad spend ÷ orders placed", "Compare with your break-even ceiling"],
          ["Net profit per order", "Net profit ÷ orders placed", "The number that decides whether to scale"],
          ["COD remittance pending", "COD delivered − COD remitted", "Shows cash you are owed"],
        ]}
      />
      <p>
        The daily and weekly routines behind these numbers are covered in our{" "}
        <PostLink slug="ecommerce-business-operations-india">guide to e-commerce business operations</PostLink>.
      </p>

      <h2 id="axqen">How AXQEN AI helps Shopify sellers</h2>
      <p>
        Shopify runs the storefront. The operations behind it usually sit in separate tools. AXQEN AI is an{" "}
        <a href="/">AI Commerce Operating System</a> that connects with Shopify and brings order processing, product
        and supplier management, shipping and NDR management, RTO management, wallet and remittance, and profit
        analytics into one dashboard. You see total, delivered and RTO orders next to net profit, so the weekly review
        above does not depend on a spreadsheet.
      </p>

      <h2 id="faq">Frequently asked questions</h2>
      {faqs.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <aside className="axq-cta">
        <div>
          <p className="axq-cta-title">Run your Shopify store on one operating system.</p>
          <p className="axq-cta-sub">Get started with AXQEN AI and see orders, shipping, returns and profit in one dashboard.</p>
        </div>
        <a href="/" className="axq-btn axq-btn-lime">Get Started with AXQEN AI →</a>
      </aside>
    </>
  );
}
