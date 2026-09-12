import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let context: unknown;
  try {
    const body = await req.json();
    context = body.context;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const prompt = `You are AXQEN Intelligence, a business advisor for Indian dropshipping sellers.

You have received the following structured business data summary for a seller's last 30 days:
${JSON.stringify(context, null, 2)}

Generate exactly 4 actionable recommendations. Each must follow this structure:
- problem: what is the specific business issue (1 sentence, factual)
- evidence: cite specific numbers from the data above only — never invent figures
- impact: what happens if this is ignored or acted on (1 sentence)
- action: specific next step the seller can take today (1 sentence)

Rules:
- Base everything on the data provided. Never fabricate metrics.
- If data is insufficient for a recommendation, skip it and replace with another.
- Be specific, not generic.
- Focus on highest-impact items first.

Respond with valid JSON only, no markdown, no explanation:
{"recommendations":[{"problem":"...","evidence":"...","impact":"...","action":"..."}]}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
