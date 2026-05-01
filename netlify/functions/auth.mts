import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;
function getSql() {
  const url = process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error("NETLIFY_DATABASE_URL no configurada");
  if (!_sql) _sql = neon(url);
  return _sql;
}

// ─── JWT ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "taxflow-dev-secret-CHANGE-IN-PROD";
const enc = new TextEncoder();

function b64u(s: string) {
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function encBuf(b: Uint8Array) {
  return btoa(String.fromCharCode(...b))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function decBuf(s: string) {
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0)
  );
}

async function signJwt(userId: string, email: string, name: string) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(
    JSON.stringify({
      sub: userId,
      email,
      name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 86400,
    })
  );
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`${h}.${p}`))
  );
  return `${h}.${p}.${encBuf(sig)}`;
}

export async function verifyJwt(
  token: string
): Promise<{ sub: string; email: string; name: string } | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      decBuf(s),
      enc.encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(
      atob(p.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Password (PBKDF2) ───────────────────────────────────────────────────────

async function hashPwd(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
      key,
      256
    )
  );
  const hex = (b: Uint8Array) =>
    Array.from(b)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  return `${hex(salt)}:${hex(hash)}`;
}

async function checkPwd(password: string, stored: string) {
  try {
    const [saltHex, hashHex] = stored.split(":");
    const salt = new Uint8Array(
      saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
    );
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const hash = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
        key,
        256
      )
    );
    const hex = (b: Uint8Array) =>
      Array.from(b)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    return hex(hash) === hashHex;
  } catch {
    return false;
  }
}

// ─── DB setup ───────────────────────────────────────────────────────────────

let ready = false;
async function ensureSchema() {
  if (ready) return;
  const sql = getSql();
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR`;
  ready = true;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const j = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ─── Handlers ───────────────────────────────────────────────────────────────

async function register(body: Record<string, string>) {
  const { email, password, name } = body;
  if (!email || !password || !name)
    return j({ error: "Nombre, email y contraseña son requeridos." }, 400);
  if (password.length < 6)
    return j({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

  await ensureSchema();
  const sql = getSql();

  const exists = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
  if (exists.length > 0)
    return j({ error: "Este email ya está registrado." }, 409);

  const hash = await hashPwd(password);
  const rows = await sql`
    INSERT INTO users (id, email, nombre, password_hash, created_at, updated_at)
    VALUES (gen_random_uuid(), ${email.toLowerCase()}, ${name}, ${hash}, NOW(), NOW())
    RETURNING id, email, nombre
  `;
  const u = rows[0];
  const token = await signJwt(u.id as string, u.email as string, u.nombre as string);
  return j({ token, user: { id: u.id, email: u.email, name: u.nombre } });
}

async function login(body: Record<string, string>) {
  const { email, password } = body;
  if (!email || !password)
    return j({ error: "Email y contraseña son requeridos." }, 400);

  await ensureSchema();
  const sql = getSql();

  const rows = await sql`
    SELECT id, email, nombre, password_hash FROM users
    WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;
  if (rows.length === 0)
    return j({ error: "Email o contraseña incorrectos." }, 401);

  const u = rows[0];
  if (!u.password_hash)
    return j({ error: "Esta cuenta usa Google para iniciar sesión." }, 400);

  if (!(await checkPwd(password, u.password_hash as string)))
    return j({ error: "Email o contraseña incorrectos." }, 401);

  const token = await signJwt(u.id as string, u.email as string, u.nombre as string);
  return j({ token, user: { id: u.id, email: u.email, name: u.nombre } });
}

async function googleAuth(body: Record<string, string>) {
  const { idToken } = body;
  if (!idToken) return j({ error: "Token de Google requerido." }, 400);

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );
  if (!res.ok)
    return j(
      { error: "Token de Google inválido. Verificá tu configuración." },
      401
    );

  const g = await res.json();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && g.aud !== clientId)
    return j({ error: "Token no autorizado para esta aplicación." }, 401);

  await ensureSchema();
  const sql = getSql();

  const email = (g.email as string).toLowerCase();
  const name = (g.name || email.split("@")[0]) as string;
  const avatarUrl = (g.picture as string) || "";

  let rows = await sql`SELECT id, email, nombre FROM users WHERE LOWER(email) = ${email} LIMIT 1`;

  if (rows.length === 0) {
    rows = await sql`
      INSERT INTO users (id, email, nombre, google_id, avatar_url, created_at, updated_at)
      VALUES (gen_random_uuid(), ${email}, ${name}, ${g.sub}, ${avatarUrl}, NOW(), NOW())
      RETURNING id, email, nombre
    `;
  } else {
    await sql`
      UPDATE users SET google_id = ${g.sub}, avatar_url = ${avatarUrl}, updated_at = NOW()
      WHERE id = ${rows[0].id}
    `;
  }

  const u = rows[0];
  const token = await signJwt(u.id as string, u.email as string, u.nombre as string);
  return j({ token, user: { id: u.id, email: u.email, name: u.nombre, avatarUrl } });
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default async (req: Request) => {
  if (req.method !== "POST") return j({ error: "Method not allowed" }, 405);

  const action = new URL(req.url).pathname.split("/").pop();
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return j({ error: "JSON inválido." }, 400);
  }

  try {
    if (action === "register") return await register(body);
    if (action === "login") return await login(body);
    if (action === "google") return await googleAuth(body);
    return j({ error: "Not found" }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("auth error:", msg);
    return j({ error: msg }, 500);
  }
};

export const config = {
  path: ["/api/auth/login", "/api/auth/register", "/api/auth/google"],
};
