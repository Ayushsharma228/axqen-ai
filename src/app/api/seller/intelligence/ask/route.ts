import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRouteSession } from "@/lib/session";
import { buildFacts } from "@/lib/seller-insights";
import { ASK_DAILY_LIMIT, askUsedToday, recordAsk } from "@/lib/ai-ask-quota";

const MODEL = "claude-haiku-5-5";
const FALLBACK_MODEL = "claude-haiku-4-5";

// Ask AXQEN: answers from the seller's own figures, built on the server (never from the browser).
// POST { question: string, history?: { role: "user" | "assistant", content: string }[] }
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Ask AXQEN isn't set up yet. Please contact support." }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { question?: unknown; history?: unknown };
  const question = String(body.question ?? "").trim().slice(0, 500);
  if (!question) return NextResponse.json({ error: "Type a question first" }, { status: 400 });

  const used = await askUsedToday(sellerId);
  if (used >= ASK_DAILY_LIMIT) {
    return NextResponse.json({ error: `You've used all ${ASK_DAILY_LIMIT} questions for today. Ask again tomorrow.`, remaining: 0 }, { status: 429 });
  }

  // Short follow-up context: last 6 turns, text only
  const history: Anthropic.MessageParam[] = (Array.isArray(body.history) ? body.history : [])
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      !!m && typeof m === "object" && ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant")
      && typeof (m as { content?: unknown }).content === "string")
    .slice(-6)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (history.length && history[0].role !== "user") history.shift();

  const facts = await buildFacts(sellerId);
  const sheet = {
    ...facts,
    products: facts.products.slice(0, 25),
    states: facts.states.slice(0, 25),
    campaigns: facts.campaigns.slice(0, 15),
  };

  const system = `You are AXQEN Intelligence, an assistant for an Indian e-commerce seller who sells through AXQEN.
The AXQEN team confirms orders by phone, ships them, handles failed deliveries (NDR) and returns, and runs the seller's Meta ads.

Answer only from the SELLER FACTS below. They cover the last ${facts.periodDays} days and use these rules:
- Profit = delivered revenue − product cost − shipping − packing − AXQEN fee − RTO loss − ad spend. Orders not yet delivered are excluded.
- RTO % = returned ÷ (delivered + returned). Product and state profit is before ads.
- costsMissing > 0 means those orders have no product cost yet, so profit figures are higher than reality: say so when you quote profit.

Rules for your answer:
- Use only numbers that appear in the facts. If the facts don't cover the question, say you don't have that data. Never estimate or invent figures.
- Write amounts in Indian rupees (₹) with Indian digit grouping.
- Be practical: give the answer, the number behind it, and one concrete next step when it helps.
- Keep it under 130 words, in plain language. Reply in the same language the seller writes in (Hindi, Hinglish or English).

SELLER FACTS:
${JSON.stringify(sheet)}`;

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: question }];
  try {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system,
        output_config: { effort: "low" },
        messages,
      } as Anthropic.MessageCreateParamsNonStreaming);
    } catch (err) {
      // Account without access to the newest Haiku: fall back to Haiku 4.5 (no effort setting on that model).
      const modelProblem = err instanceof Anthropic.NotFoundError
        || (err instanceof Anthropic.BadRequestError && /model|output_config|effort/i.test(err.message));
      if (!modelProblem) throw err;
      console.warn("[intelligence/ask] falling back to", FALLBACK_MODEL, err instanceof Error ? err.message : err);
      response = await client.messages.create({ model: FALLBACK_MODEL, max_tokens: 1500, system, messages });
    }

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "I can't help with that one. Try asking about your orders, profit, products or ads." }, { status: 422 });
    }
    const answer = response.content
      .map(b => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!answer) return NextResponse.json({ error: "I couldn't put an answer together. Please try again." }, { status: 502 });

    const nowUsed = await recordAsk(sellerId);
    return NextResponse.json({ answer, remaining: Math.max(0, ASK_DAILY_LIMIT - nowUsed) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Ask AXQEN is busy right now. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("[intelligence/ask]", err.status, err.message);
      return NextResponse.json({ error: "Ask AXQEN's AI key isn't valid. The AXQEN team needs to update it.", detail: err.message }, { status: 502 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[intelligence/ask]", err.status, err.message);
      const credit = /credit balance|billing/i.test(err.message);
      return NextResponse.json({
        error: credit ? "Ask AXQEN is paused: the AI account is out of credit. The AXQEN team needs to top it up." : "Ask AXQEN couldn't answer right now. Please try again.",
        detail: `${err.status ?? ""} ${err.message}`.trim().slice(0, 300),
      }, { status: 502 });
    }
    console.error("[intelligence/ask]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
