import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const system = `You are AXQEN Intelligence, an AI assistant for an Indian dropshipping seller.
Answer questions based only on the seller data provided below. Be concise and factual.
Never fabricate numbers. If the data doesn't contain the answer, say so clearly.
Use Indian Rupee (₹) for monetary values. Keep answers under 150 words.

SELLER DATA (last 30 days):
${JSON.stringify(context, null, 2)}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: question }],
    });

    const answer = response.content[0].type === "text" ? response.content[0].text : "Sorry, I couldn't generate an answer.";
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "AI failed" }, { status: 500 });
  }
}
