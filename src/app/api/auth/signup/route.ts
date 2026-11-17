import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // username and confirmPassword are optional (older clients still send them); phone is optional for those clients too.
    const { name, email, username, password, confirmPassword, phone } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (username && !/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Username: only lowercase letters, numbers and underscores" }, { status: 400 });
    }

    let normalizedPhone: string | null = null;
    if (phone !== undefined && phone !== null && String(phone).trim() !== "") {
      const digits = String(phone).replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
      if (!/^[6-9]\d{9}$/.test(digits)) {
        return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
      }
      normalizedPhone = `+91${digits}`;
    }

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      username ? prisma.user.findFirst({ where: { username } }) : Promise.resolve(null),
    ]);

    if (existingEmail) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    if (existingUsername) return NextResponse.json({ error: "This username is already taken" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        username: username || null,
        phone: normalizedPhone,
        password: hashed,
        role: "SELLER",
        accountStatus: "PENDING",
        onboardingDone: false,
      },
    });

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
