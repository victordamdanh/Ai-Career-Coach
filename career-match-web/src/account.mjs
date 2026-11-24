function accountResponse(data, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

async function accountInput(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Expected JSON.");
  if (Number(request.headers.get("content-length")) > 64_000) throw new Error("The record is too long.");
  const input = await request.text();
  if (input.length > 16_000) throw new Error("The record is too long.");
  const value = JSON.parse(input);
  if (!value || typeof value !== "object") throw new Error("Invalid record.");
  return value;
}

function field(value, max, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error("Invalid form field.");
  return value.trim();
}

export async function account(request, env = {}) {
  const url = new URL(request.url);
  const isAccount = url.pathname === "/api/account";
  const isRead = request.method === "GET";
  const owner = env.LOCAL_SQLITE ? "local-workstation" : request.headers.get("oai-authenticated-user-id");
  const unavailable = !env.DB ? "unavailable" : !owner ? "sign-in" : null;
  if (unavailable) {
    if (isAccount && isRead) return accountResponse({ available: unavailable });
    return accountResponse({ error: unavailable === "unavailable" ? "Storage is unavailable." : "Sign in to save your records." }, unavailable === "unavailable" ? 503 : 401);
  }
  if (!isRead && request.headers.get("origin") !== url.origin) return accountResponse({ error: "Open the demo before changing records." }, 403);
  const { DB } = env;
  try {
    if (isAccount && isRead) {
      const [candidate, jobs] = await Promise.all([
        DB.prepare("SELECT name, email, phone, resume FROM candidate_profiles WHERE owner = ?").bind(owner).first(),
        DB.prepare("SELECT company, job_id, title, url, location, excerpt FROM saved_jobs WHERE owner = ? ORDER BY saved_at DESC LIMIT 50").bind(owner).all(),
      ]);
      return accountResponse({ available: "ready", candidate, jobs: jobs.results });
    }
    if (isAccount && request.method === "DELETE") {
      await DB.batch([
        DB.prepare("DELETE FROM candidate_profiles WHERE owner = ?").bind(owner),
        DB.prepare("DELETE FROM saved_jobs WHERE owner = ?").bind(owner),
      ]);
      return accountResponse({ ok: true });
    }
    if (isAccount && request.method === "PUT") {
      const input = await accountInput(request);
      const name = field(input.name, 100);
      const email = field(input.email, 254);
      const phone = field(input.phone, 40);
      const resume = field(input.resume, 3000, true);
      await DB.prepare(`INSERT INTO candidate_profiles (owner, name, email, phone, resume) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(owner) DO UPDATE SET name=excluded.name, email=excluded.email, phone=excluded.phone, resume=excluded.resume`)
        .bind(owner, name, email, phone, resume).run();
      return accountResponse({ ok: true });
    }
    if (!isAccount && request.method === "POST") {
      const input = await accountInput(request);
      const id = field(String(input.id ?? ""), 100, true);
      const company = field(input.company, 100, true);
      const title = field(input.title, 300, true);
      const official = new URL(field(input.url, 800, true));
      const location = field(input.location, 300);
      const excerpt = field(input.excerpt, 3000);
      if (official.protocol !== "https:" || official.username || official.password) throw new Error("Invalid job link.");
      await DB.prepare(`INSERT INTO saved_jobs (owner, company, job_id, title, url, location, excerpt) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner, company, job_id) DO UPDATE SET title=excluded.title, url=excluded.url, location=excluded.location,
        excerpt=excluded.excerpt, saved_at=CURRENT_TIMESTAMP`).bind(owner, company, id, title, official.href, location, excerpt).run();
      return accountResponse({ ok: true });
    }
    return accountResponse({ error: "Route unavailable." }, 404);
  } catch {
    return accountResponse({ error: "Unable to access that record. Check the fields and try again." }, 400);
  }
}
