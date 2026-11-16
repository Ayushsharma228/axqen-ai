import { PostLink, Source, Table, Checklist, Cta } from "../_components/Prose";
import { getPost } from "../posts";

// TODO(product owner): paste the exact Razorpay and ClickPost source URLs; the citations render as plain text until then.
const RAZORPAY_URL: string | undefined = undefined;
const CLICKPOST_URL: string | undefined = undefined;

export default function StartDropshippingBusinessIndia() {
  const faqs = getPost("start-dropshipping-business-india")?.faqs ?? [];

  return (
    <>
      <p>
        Dropshipping lets you start an online store in India without buying stock first. You list a product, a
        customer orders it, and your supplier ships it directly to them. You keep the difference between your
        selling price and your costs.
      </p>
      <p>
        The model is easy to launch and hard to run. Most stores that fail do not fail because of the product. They
        fail because the owner never worked out what one order actually earns after shipping, ads and returns. This
        guide gives you the steps, a sample budget, a worked profit example and a supplier checklist so you can start
        with the numbers in front of you.
      </p>

      <h2 id="india">What dropshipping in India really looks like</h2>
      <p>Indian dropshipping is not a copy of the US model. Three facts shape everything:</p>
      <ul>
        <li>
          <strong>Cash on delivery dominates.</strong> Around 60 to 65% of Indian e-commerce orders are placed as COD,
          according to ET Prime Research (2024) as cited by <Source href={RAZORPAY_URL}>Razorpay</Source>.
        </li>
        <li>
          <strong>Returns to origin (RTO) eat margin.</strong> On ClickPost&rsquo;s FY2026 D2C network, 37.51% of COD
          orders ended as RTO against 5.28% of prepaid orders. Meesho&rsquo;s FY25 prospectus reported 22.3% of COD
          orders undelivered against 2.72% of prepaid (<Source href={CLICKPOST_URL}>ClickPost</Source>). India has no
          single official RTO rate, so treat these as reference points.
        </li>
        <li>
          <strong>Cash arrives late.</strong> You pay for ads today. COD money reaches you only after delivery and the
          courier&rsquo;s remittance cycle. Our guide to{" "}
          <PostLink slug="cod-dropshipping-india">how COD dropshipping works</PostLink> follows that money step by
          step.
        </li>
      </ul>

      <h2 id="niche">Step 1: Choose a niche you can stay in</h2>
      <p>
        Pick a category where one customer could buy several related products. Home and kitchen, fitness
        accessories, pet supplies and car accessories are common starting points.
      </p>
      <p>Screen every product idea against four filters:</p>
      <ul>
        <li>Light and sturdy, so shipping is cheap and damage is rare</li>
        <li>No size or fit decision, which reduces returns</li>
        <li>Priced high enough to carry shipping, ads and RTO</li>
        <li>Easy to explain in one sentence</li>
      </ul>
      <p>
        For a fuller method, see{" "}
        <PostLink slug="find-winning-products-online-store">how to find winning products</PostLink>.
      </p>

      <h2 id="setup">Step 2: Set up the business properly</h2>
      <p>
        Decide your structure (sole proprietorship, LLP or private limited), open a current account, and sort out GST
        before your first sale. GST rules differ depending on whether you sell through marketplaces or only through
        your own website, and they have been revised more than once. Ask a CA which rule applies to you.
      </p>

      <h2 id="budget">Step 3: Plan your startup budget</h2>
      <p>
        You do not need inventory, but you do need money for testing and for the gap before COD cash returns. Below is
        a sample first-month budget for a single-niche store. Every figure is an illustrative assumption. Replace each
        line with a real quote before you commit.
      </p>
      <Table
        head={["Item", "Sample amount", "What it covers"]}
        rows={[
          ["Store platform and domain", "₹3,000", "First month of your store plan plus a domain. Check the current plan price before budgeting."],
          ["Business setup and compliance", "₹3,000", "CA help with registration and GST"],
          ["Sample orders", "₹2,500", "Samples of 4 to 5 shortlisted products"],
          ["Photos and ad creatives", "₹3,000", "Product photos and short videos"],
          ["Test ad budget", "₹15,000", "₹500 a day for 30 days across 3 to 5 products"],
          ["Shipping wallet and RTO buffer", "₹10,000", "Courier wallet recharge and the cost of returned parcels"],
          ["Miscellaneous", "₹2,000", "Packaging inserts, tools, contingency"],
        ]}
        total={["Total", "₹38,500", ""]}
      />
      <p>
        The two lines beginners skip are the last two. Without a shipping and RTO buffer, a store can run out of cash
        while it is technically profitable.
      </p>

      <h2 id="unit-economics">Step 4: Work out your unit economics before you spend</h2>
      <p>
        Unit economics simply means: what does a batch of orders earn after every cost? Here is a worked example for
        100 orders. All inputs are assumptions for illustration.
      </p>
      <p>
        <strong>Assumptions:</strong> selling price ₹799, product cost ₹250, forward shipping ₹70 per order, COD
        handling fee ₹35 per delivered COD order, payment gateway fee 2% on prepaid orders, return shipping ₹60 per
        RTO, ad cost ₹150 per order. Order mix: 60 COD and 40 prepaid. RTO: 30% on COD, 5% on prepaid. Product cost is
        paid only on delivered orders.
      </p>
      <Table
        head={["Line", "Calculation", "Amount"]}
        rows={[
          ["Orders delivered", "42 COD + 38 prepaid", "80"],
          ["Orders returned (RTO)", "18 COD + 2 prepaid", "20"],
          ["Revenue", "80 × ₹799", "₹63,920"],
          ["Product cost", "80 × ₹250", "₹20,000"],
          ["Forward shipping", "100 × ₹70", "₹7,000"],
          ["COD handling fee", "42 × ₹35", "₹1,470"],
          ["Payment gateway fee", "2% of ₹30,362", "₹607"],
          ["Return shipping", "20 × ₹60", "₹1,200"],
          ["Ad spend", "100 × ₹150", "₹15,000"],
        ]}
        total={["Net profit", "₹63,920 − ₹45,277", "₹18,643"]}
      />
      <p>
        That is about ₹186 per order placed, before salaries and fixed costs. Notice what happened: 20 returned orders
        earned nothing but still cost shipping both ways and ₹150 each in ads. This is why two stores with the same
        sales can have very different bank balances. We compare the two payment modes in detail in{" "}
        <PostLink slug="prepaid-vs-cod-orders-india">prepaid vs COD orders</PostLink>.
      </p>
      <Cta compact />

      <h2 id="suppliers">Step 5: Find and evaluate suppliers</h2>
      <p>
        Your supplier is your warehouse, your packing team and your quality check. Score every supplier on this
        checklist before you send them a real order:
      </p>
      <Checklist
        items={[
          "Sample received and quality matches the listing photos",
          "Dispatches within the time they promise, tested with a sample order",
          "Ships COD parcels and shares tracking the same day",
          "Stock levels are shared or updated regularly",
          "Clear policy for damaged, wrong and returned items",
          "Does not charge product cost on RTO parcels, or the charge is agreed in writing",
          "Packaging is plain or carries your branding, with no supplier invoice inside",
          "GST invoice is provided",
          "A named contact answers within working hours",
          "A second supplier is identified for your best product",
        ]}
      />

      <h2 id="store">Step 6: Build your store</h2>
      <p>
        Most Indian dropshippers start on Shopify because it is quick to set up and connects with payment gateways and
        courier partners. Keep the first version simple: honest photos, a clear price, delivery time and return
        policy. Our <PostLink slug="profitable-shopify-store-india">guide to building a profitable Shopify store</PostLink>{" "}
        has the full setup walkthrough and launch checklist.
      </p>

      <h2 id="payments">Step 7: Set up payments and shipping</h2>
      <p>
        Offer both COD and prepaid. Add a payment gateway for UPI and cards, and a courier partner that covers the pin
        codes you plan to serve. Give customers a small reason to prepay, such as a discount or faster dispatch.
      </p>

      <h2 id="ndr">Step 8: Confirm orders, then act on failed deliveries</h2>
      <p>
        A COD order is a promise to pay, not a payment. Confirm address and intent before dispatch. When a delivery
        attempt fails, respond the same day. On ClickPost&rsquo;s FY2026 network, 20.2% of orders ended as RTO after
        one failed attempt, 45.5% after two and 88.5% after three or more (
        <Source href={CLICKPOST_URL}>ClickPost</Source>). The first failed attempt is your best chance to save the
        order.
      </p>

      <h2 id="first-30-days">Your first 30 days</h2>
      <Table
        head={["Week", "Focus"]}
        rows={[
          ["Week 1", "Niche, business setup, supplier shortlist, sample orders"],
          ["Week 2", "Store build, payments, shipping, policies, test order"],
          ["Week 3", "Launch ads on 3 to 5 products with equal small budgets"],
          ["Week 4", "Compare products on delivered orders and net profit. Keep the best, drop the rest."],
        ]}
      />

      <h2 id="axqen">Where AXQEN AI fits</h2>
      <p>
        Most new sellers end up with a store admin, a courier panel, a supplier chat and a spreadsheet. AXQEN AI is an
        AI Commerce Operating System that brings those pieces into one dashboard: store setup and management, product
        and supplier management, order processing, shipping and NDR management, RTO management, wallet and remittance,
        and profit analytics. It connects with Shopify and Amazon, with Flipkart, Meesho and Easebuzz coming soon.
        Instead of rebuilding the table above in a spreadsheet every week, you see delivered orders, RTO and net
        profit in one place.
      </p>

      <h2 id="faq">Frequently asked questions</h2>
      {faqs.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <Cta />
    </>
  );
}
