import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accessToken, adAccountId } = await req.json();
  if (!accessToken?.trim() || !adAccountId?.trim()) {
    return NextResponse.json({ error: "Access token and Ad Account ID are required" }, { status: 400 });
  }

  const normalizedAccountId = adAccountId.trim().startsWith("act_")
    ? adAccountId.trim()
    : `act_${adAccountId.trim()}`;

  // Verify the token is valid by calling Graph API
  const verifyRes = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken.trim()}`
  );
  const verifyData = await verifyRes.json();
  if (verifyData.error || !verifyData.id) {
    return NextResponse.json({ error: "Invalid access token — please check and try again" }, { status: 400 });
  }

  // 60 days from now (standard long-lived token duration)
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      metaAccessToken:    encrypt(accessToken.trim()),
      metaAdAccountId:    normalizedAccountId,
      metaTokenExpiresAt: expiresAt,
    },
  });

  return NextResponse.json({ success: true, fbName: verifyData.name });
}
