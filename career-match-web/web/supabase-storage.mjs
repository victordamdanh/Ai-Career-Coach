import { historyId, historyText, historyLink, normalizeHistory } from "./history-records.mjs";

export function createSupabaseStorage({ url, key }, fetcher = fetch) {
  let session;
  const result = (data, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
  const accountState = available => ({ available, provider: "supabase" });
  async function call(path, method = "GET", body, params = {}, prefer, authenticated = true) {
    const headers = { apikey: key, "content-type": "application/json" };
    if (authenticated && session) headers.Authorization = "Bearer " + session.token;
    if (prefer) headers.Prefer = prefer;
    const query = new URLSearchParams(params).toString();
    let response;
    try {
      response = await fetcher(url + "/" + path + (query ? "?" + query : ""), { method, headers, cache: "no-store", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch { throw Object.assign(new Error("Could not reach Supabase. Check your connection and try again."), { status: 503 }); }
    if (!response.ok) {
      if (authenticated && [401, 403].includes(response.status)) {
        session = undefined;
        throw Object.assign(new Error("Your session expired. Sign in again."), { status: 401 });
      }
      throw Object.assign(new Error(authenticated ? "Supabase could not complete the request." : "Could not sign in or create the account. Check your email, password, and email confirmation."), { status: authenticated ? 502 : 400 });
    }
    return response.status === 204 ? null : response.json().catch(() => null);
  }
  async function signIn(email, password, signup = false) {
    const data = await call(signup ? "auth/v1/signup" : "auth/v1/token", "POST", { email, password }, signup ? {} : { grant_type: "password" }, undefined, false);
    if (data?.access_token && historyId(data.user?.id)) {
      session = { token: data.access_token, owner: data.user.id };
      return true;
    }
    if (signup) return false;
    throw new Error("Sign-in did not return a valid session.");
  }
  async function signOut() {
    try { if (session) await call("auth/v1/logout", "POST", undefined, { scope: "local" }); }
    finally { session = undefined; }
  }
  const owner = () => ({ user_id: "eq." + session.owner });
  async function allRows(table, params) {
    const rows = [];
    for (let offset = 0; ; offset += 200) {
      const page = await call("rest/v1/" + table, "GET", undefined, { ...owner(), ...params, limit: 200, offset });
      if (!Array.isArray(page)) throw new Error("Invalid storage response.");
      rows.push(...page);
      if (page.length < 200) return rows;
    }
  }
  const profileTable = "rest/v1/career_candidate_profiles";
  const jobTable = "rest/v1/career_saved_jobs";
  const historyTable = "rest/v1/career_history_records";
  async function request(path, options = {}) {
    const method = options.method ?? "GET";
    if (!session) return path === "account" && method === "GET" ? result(accountState("sign-in")) : result({ error: "Sign in to access your saved records." }, 401);
    try {
      if (path === "account" && method === "GET") {
        const [profiles, jobs] = await Promise.all([
          call(profileTable, "GET", undefined, { ...owner(), select: "name,email,phone,resume", limit: 1 }),
          allRows("career_saved_jobs", { select: "company,job_id,title,url,location,excerpt", order: "saved_at.desc,company,job_id" }),
        ]);
        return result({ ...accountState("ready"), candidate: profiles[0] ?? null, jobs });
      }
      if (path === "account" && method === "DELETE") {
        await call("rest/v1/rpc/clear_career_account", "POST", {});
        return result({ ok: true });
      }
      if (path === "history" && method === "GET") {
        const rows = await allRows("career_history_records", { select: "record_id,kind,name,created_at,payload", order: "created_at.desc,record_id" });
        return result({ records: rows.map(row => ({ id: row.record_id, kind: row.kind, name: row.name, createdAt: row.created_at, payload: row.payload })) });
      }
      const input = JSON.parse(options.body ?? "{}");
      if (path === "history" && method === "POST") {
        const record = normalizeHistory(input);
        await call(historyTable, "POST", { user_id: session.owner, record_id: record.id, kind: record.kind, name: record.name, created_at: record.createdAt, payload: record.payload }, { on_conflict: "user_id,record_id" }, "resolution=merge-duplicates");
      } else if (path === "history" && method === "DELETE") {
        if (!historyId(input.id)) throw new Error("Invalid record ID.");
        await call(historyTable, "DELETE", undefined, { ...owner(), record_id: "eq." + input.id });
      } else if (path === "account" && method === "PUT") {
        await call(profileTable, "POST", { user_id: session.owner, name: historyText(input.name, 100), email: historyText(input.email, 254), phone: historyText(input.phone, 40), resume: historyText(input.resume, 14000, true) }, { on_conflict: "user_id" }, "resolution=merge-duplicates");
      } else if (path === "saved-jobs" && method === "POST") {
        const link = historyLink(input.url);
        if (!link || link.length > 500) throw new Error("Use a valid HTTPS job link.");
        await call(jobTable, "POST", { user_id: session.owner, company: historyText(input.company, 100, true), job_id: historyText(String(input.id ?? ""), 100, true), title: historyText(input.title, 300, true), url: link, location: historyText(input.location ?? "", 300), excerpt: historyText(input.excerpt ?? "", 3000), saved_at: new Date().toISOString() }, { on_conflict: "user_id,company,job_id" }, "resolution=merge-duplicates");
      } else return result({ error: "Route unavailable." }, 404);
      return result({ ok: true });
    } catch (error) {
      if (path === "account" && method === "GET" && error.status === 401) return result(accountState("sign-in"));
      return result({ error: error.status ? error.message : "Check the record fields and try again." }, error.status || 400);
    }
  }
  return { request, signIn, signOut, token: () => session?.token };
}
