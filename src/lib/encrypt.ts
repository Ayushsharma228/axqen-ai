import crypto from "crypto";

// Derives a 32-byte AES key from NEXTAUTH_SECRET so no extra env var is needed
function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return crypto.createHash("sha256").update(secret).digest();
}

// Returns "iv:authTag:ciphertext" (all hex) — safe to store in DB
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// Returns the original plaintext.
// If the value is not in encrypted format (legacy plaintext token), returns it as-is.
export function decrypt(value: string): string {
  const parts = value.split(":");
  if (parts.length !== 3) return value; // legacy plaintext — return unchanged
  const [ivHex, authTagHex, encryptedHex] = parts;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return value; // decryption failed — treat as legacy plaintext
  }
}

/** "1234 5678 9012" or "XXXX XXXX 9012" → "XXXX XXXX 9012". Full Aadhaar numbers never leave the server. */
export function maskAadhaar(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.replace(/\D/g, "");
  return d.length >= 4 ? `XXXX XXXX ${d.slice(-4)}` : "XXXX XXXX XXXX";
}
