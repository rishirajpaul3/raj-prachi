// Password hashing using Web Crypto API (no external deps, works in Edge runtime)

async function pbkdf2Hash(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  const saltArray = crypto.getRandomValues(new Uint8Array(16));
  const saltBuffer = saltArray.buffer.slice(0) as ArrayBuffer;
  const salt = new Uint8Array(saltBuffer);
  const hash = await pbkdf2Hash(password, salt, 100_000);
  return `${bufferToHex(saltBuffer)}:${bufferToHex(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt: Uint8Array<ArrayBuffer> = new Uint8Array(
    saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );
  const hash = await pbkdf2Hash(password, salt, 100_000);
  return bufferToHex(hash) === hashHex;
}
