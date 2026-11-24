import { api } from "./api.mjs";

export function createClassroomRequest() {
  let candidate = null;
  let jobs = [];
  return async function request(path, options) {
    const method = options?.method ?? "GET";
    if (path === "account") {
      if (method === "GET") return Response.json({ available: "ready", candidate, jobs });
      if (method === "PUT") candidate = JSON.parse(options.body);
      if (method === "DELETE") {
        candidate = null;
        jobs = [];
      }
      return Response.json({ ok: true });
    }
    if (path === "saved-jobs" && method === "POST") {
      const listing = JSON.parse(options.body);
      jobs = [listing, ...jobs.filter(job => job.company !== listing.company || job.id !== listing.id)].slice(0, 50);
      return Response.json({ ok: true });
    }

    return api(new Request(new URL("/api/" + path, "https://classroom.invalid"), options));
  };
}
