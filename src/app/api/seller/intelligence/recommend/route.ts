import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  let context: unknown;
  try {
    const body = await req.json();
    context = body.context;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are AXQEN Intelligence, a business advisor for Indian dropshipping sellers.

Seller business data (last 30 days):
${JSON.stringify(context, null, 2)}

Generate exactly 4 actionable recommendations. Each must be grounded strictly in the data above — never invent numbers.

Respond with ONLY valid JSON (no markdown, no explanation, no code fences):
{"recommendations":[{"problem":"...","evidence":"...","impact":"...","action":"..."},{"problem":"...","evidence":"...","impact":"...","action":"..."},{"problem":"...","evidence":"...","impact":"...","action":"..."},{"problem":"...","evidence":"...","impact":"...","action":"..."}]}

Rules:
- problem: specific business issue in 1 sentence
- evidence: cite actual numbers from the data only
- impact: what happens if ignored or acted on (1 sentence)
- action: specific next step the seller can take (1 sentence)`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Extract JSON even if model wraps it in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.recommendations)) throw new Error("Bad structure");

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Intelligence recommend error:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
