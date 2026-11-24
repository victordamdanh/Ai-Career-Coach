import { checkRemoteListing, companyBoards, fetchListing, fetchListings, recommendCompanies } from "./listings.mjs?v=3d7ed6ef386c";
import { jobs, resume, description, walkthrough } from "./data.mjs?v=3d7ed6ef386c";

const categoriesList = ["skills", "experience", "education", "certifications", "projects"];
const priorities = { required: 2, preferred: 1 };
const credit = { match: 1, partial: 0.5, gap: 0 };

export function score(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) throw new Error("The scoring tool needs 1–20 requirements.");
  if (rows.some(row => !row || !categoriesList.includes(row.category) || !Object.hasOwn(credit, row.status) || !Object.hasOwn(priorities, row.priority))) {
    throw new Error("Invalid category or evidence status.");
  }
  const categories = categoriesList.map(category => {
    const group = rows.filter(row => row.category === category);
    const rate = group.length ? group.reduce((sum, row) => sum + credit[row.status], 0) / group.length : null;
    return { category, rate, count: group.length };
  });
  const possible = rows.reduce((sum, row) => sum + priorities[row.priority], 0);
  const earned = rows.reduce((sum, row) => sum + priorities[row.priority] * credit[row.status], 0);
  return { score: Math.round(100 * earned / possible), earned, possible, categories };
}

export async function api(request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/companies" && request.method === "GET") return Response.json(companyBoards);
  if (path === "/api/recommend" && request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const roles = params.getAll("role");
    const skills = params.getAll("skill");
    const place = params.get("place") ?? "";
    const level = params.get("level") ?? "";
    const pay = params.get("pay") ?? "";
    if (!roles.length || roles.length > 16 || roles.some(role => role.length > 90 || !/[\p{L}\p{N}]/u.test(role)) ||
      skills.length > 16 || skills.some(skill => skill.length > 50 || !/[a-z0-9]/i.test(skill)) ||
      place.length > 90 || level.length > 80 || pay.length > 80) {
      return Response.json({ error: "Enter a job title or add resume skills to find matching companies." }, { status: 400 });
    }
    return Response.json(await recommendCompanies({ roles, place, level, pay, skills, includeRemote: true }));
  }
  if (path === "/api/remote-status" && request.method === "GET") {
    try {
      const id = new URL(request.url).searchParams.get("id");
      return Response.json({ status: await checkRemoteListing(id) });
    } catch {
      return Response.json({ error: "The live posting status could not be checked. Open the source link to check it." }, { status: 502 });
    }
  }
  if (path === "/api/listing" && request.method === "GET") {
    const params = new URL(request.url).searchParams;
    try {
      return Response.json(await fetchListing(params.get("company"), params.get("id")));
    } catch {
      return Response.json({ error: "The posting could not be loaded. Open the official company link to check it." }, { status: 502 });
    }
  }
  if (path === "/api/listings" && request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const company = params.get("company") ?? "";
    const phrase = params.get("q") ?? "";
    if (!Object.hasOwn(companyBoards, company) || phrase.length > 100) {
      return Response.json({ error: "Choose a supported company and use up to 100 characters." }, { status: 400 });
    }
    try {
      return Response.json(await fetchListings(company, phrase));
    } catch {
      return Response.json({ error: "This company career board is temporarily unavailable. Try another company or use a sample." }, { status: 502 });
    }
  }
  if (path === "/api/dataset" && request.method === "GET") {
    return Response.json({ resume, jobs: jobs.map(({ id, title, source, url, note, ...job }) => ({
      id, title, source, url, note, description: description(job),
    })) });
  }
  if (path === "/api/walkthrough" && request.method === "GET") {
    const job = jobs.find(item => item.id === new URL(request.url).searchParams.get("id"));
    if (!job) return Response.json({ error: "Sample posting unavailable." }, { status: 404 });
    const result = walkthrough(job);
    return Response.json({ ...result, rubric: score(result.rows) });
  }
  if (path === "/api/score" && request.method === "POST") {
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error("Send the scoring inputs as JSON.");
      const decoder = new TextDecoder();
      let raw = "";
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return Response.json({ error: "Scoring request is too large." }, { status: 413 });
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      return Response.json(score(JSON.parse(raw)));
    } catch {
      return Response.json({ error: "Invalid scoring inputs." }, { status: 400 });
    }
  }
  return Response.json({ error: "Route unavailable." }, { status: 404 });
}
