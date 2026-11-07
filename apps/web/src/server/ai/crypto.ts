import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado de las API keys de cada usuario (AES-256-GCM).
 * La llave maestra sale de APP_ENCRYPTION_KEY (o, si falta, de BETTER_AUTH_SECRET).
 * Si cambias esa variable, las llaves guardadas dejan de poder leerse y hay que capturarlas otra vez.
 */
function masterKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Falta APP_ENCRYPTION_KEY o BETTER_AUTH_SECRET para cifrar llaves");
  return createHash("sha256").update(`quincena:ai-keys:${secret}`).digest();
}

/** Texto plano → "v1:iv:tag:cifrado" en base64url. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(payload: string): string | null {
  try {
    const [v, iv, tag, data] = payload.split(":");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "sk-proj-…a1b2" → "a1b2" */
export const keyHint = (key: string) => key.trim().slice(-4);
