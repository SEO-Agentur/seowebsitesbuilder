/**
 * AES-256-GCM helpers for at-rest encryption of user-supplied AI keys.
 *
 * The master key is read from KEY_ENCRYPTION_SECRET (64-char hex string).
 * Each ciphertext is stored as: base64(iv).base64(authTag).base64(ciphertext)
 *
 * If the master key is rotated, all previously-stored encrypted keys become
 * unreadable — handle rotation via a re-encrypt flow, not by swapping the env.
 */

import crypto from "node:crypto";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const hex = process.env.KEY_ENCRYPTION_SECRET || "";
  if (hex.length !== 64) {
    throw new Error(
      "KEY_ENCRYPTION_SECRET must be a 64-char hex string (32 bytes). " +
      "Generate one with `openssl rand -hex 32` and add it to the orchestrator env.",
    );
  }
  cachedKey = Buffer.from(hex, "hex");
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(".");
  if (parts.length !== 3) throw new Error("Malformed ciphertext");
  const [iv, tag, enc] = parts.map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Return only the first and last few characters — for UI display without full disclosure. */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 12) return "•".repeat(plaintext.length);
  return `${plaintext.slice(0, 4)}…${plaintext.slice(-4)}`;
}
