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

  let question: string, context: unknown;
  try {
    const body = await req.json();
    question = String(body.question ?? "").slice(0, 500);
    context  = body.context ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!question.trim())
    return NextResponse.json({ error: "Question required" }, { status: 400 });

  const client = new Anthropic({ apiKey });

  const system = `You are AXQEN Intelligence, an AI assistant for an Indian dropshipping seller.
Answer questions based ONLY on the seller data provided. Be concise and factual.
Never fabricate numbers. If the data does not contain the answer, say "I don't have enough data to answer that."
Use Indian Rupee (₹) for monetary values. Keep answers under 120 words.

SELLER DATA (last 30 days):
${JSON.stringify(context, null, 2)}`;

  try {
    const client_instance = new Anthropic({ apiKey });
    const response = await client_instance.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: question }],
    });

    const answer = response.content[0].type === "text"
      ? response.content[0].text
      : "I couldn't generate an answer right now.";

    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Intelligence ask error:", err);
    return NextResponse.json({ error: "AI failed" }, { status: 500 });
  }
}
