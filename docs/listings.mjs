export const companyBoards = {
  anthropic: "Anthropic", airbnb: "Airbnb", cloudflare: "Cloudflare", databricks: "Databricks",
  discord: "Discord", dropbox: "Dropbox", figma: "Figma", reddit: "Reddit", roblox: "Roblox", stripe: "Stripe",
};
const boardCache = new Map();
const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", ndash: "–", mdash: "—" };
const levelPatterns = {
  intern: /\bintern(?:ship)?s?\b/i,
  entry: /\b(?:intern(?:ship)?|entry[ -]level|early career|new grad(?:uate)?|junior|associate|university graduate|graduate program)\b/i,
  senior: /\b(?:senior|staff|principal|lead)\b/i,
  manager: /\b(?:manager|director|head of)\b/i,
};

function decode(html) {
  return html.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/gi, (whole, name) => {
    if (name[0] !== "#") return entities[name] ?? whole;
    const value = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return value <= 0x10ffff ? String.fromCodePoint(value) : whole;
  });
}

export function jobText(html) {
  const markup = /&lt;\/?[a-z]/i.test(html) ? decode(html) : html;
  return decode(markup.replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")).replace(/[^\S\n]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
}

function excerpt(description) {
  if (description.length <= 2900) return description;
  const headings = /(?:^|\n)\s*(?:what you(?:’|'| wi)ll (?:bring|need)|minimum qualifications|required qualifications|requirements|what we(?:’|'| a)re looking for|about you|qualifications|desired skills)(?:\s|:|$)/i;
  const position = description.search(headings);
  return position >= 0 ? description.slice(position, position + 2900).trim() : description.slice(0, 2900).trim();
}

function boardUrl(company) {
  if (!Object.hasOwn(companyBoards, company)) throw new Error("Choose a supported company.");
  return "https://boards-api.greenhouse.io/v1/boards/" + company + "/jobs";
}

async function boardJobs(company, withContent, fetcher) {
  const url = boardUrl(company) + (withContent ? "?content=true" : "");
  const cached = boardCache.get(url);
  if (cached && cached.expires >= Date.now()) return cached.jobs;
  const response = await fetcher(url, { signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("The company career board is unavailable.");
  const { jobs } = await response.json();
  if (!Array.isArray(jobs)) throw new Error("The company career board returned an unexpected response.");
  boardCache.set(url, { jobs, expires: Date.now() + 60_000 });
  return jobs;
}

function toListing(job, company) {
  if (!Number.isSafeInteger(job.id) || typeof job.title !== "string" || typeof job.absolute_url !== "string") return null;
  let official;
  try { official = new URL(job.absolute_url); } catch { return null; }
  if (official.protocol !== "https:" || official.username || official.password) return null;
  const listing = { id: job.id, title: job.title, location: job.location?.name || "See official posting",
    company: companyBoards[company], companyId: company, url: official.href };
  if (typeof job.content === "string") {
    const description = jobText(job.content);
    return { ...listing, description: description.slice(0, 18_000), excerpt: excerpt(description) };
  }
  return listing;
}

export async function fetchListings(company, phrase, fetcher = fetch) {
  const entries = await boardJobs(company, true, fetcher);
  const query = phrase.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const found = entries.filter(job => {
    const terms = [job.title, job.location?.name, ...(job.departments ?? []).map(dept => dept.name)]
      .join(" ").toLowerCase();
    return query.every(word => terms.includes(word));
  });
  const jobs = found.slice(0, 10).map(job => toListing(job, company)).filter(listing => listing?.description);
  return { company: companyBoards[company], total: found.length, jobs };
}

export async function fetchListing(company, id, fetcher = fetch) {
  if (!/^\d+$/.test(id)) throw new Error("Choose a valid listing.");
  const response = await fetcher(boardUrl(company) + "/" + id, { cache: "no-cache", signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("The posting is no longer available.");
  const listing = toListing(await response.json(), company);
  if (listing && String(listing.id) !== String(id)) throw new Error("The company board returned a different posting.");
  if (!listing?.description) throw new Error("The posting has no readable description.");
  return listing;
}

const titleKey = text => " " + text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";

export async function recommendCompanies({ roles, place, level }, fetcher = fetch) {
  const query = [...new Set(roles.map(titleKey))].filter(role => role.trim());
  const location = place.toLowerCase().trim().split(/[\s,]+/).filter(Boolean);
  const companies = Object.keys(companyBoards);
  const results = await Promise.allSettled(companies.map(async company => {
    const jobs = await boardJobs(company, false, fetcher);
    const matches = [];
    for (const job of jobs) {
      const listing = toListing(job, company);
      if (!listing || (level && !levelPatterns[level].test(listing.title))) continue;
      if (!location.every(word => listing.location.toLowerCase().includes(word))) continue;
      const title = titleKey(listing.title);
      const rank = query.reduce((total, role, index) => title.includes(role) ? total + query.length - index : total, 0);
      if (rank) matches.push({ listing, rank });
    }
    matches.sort((a, b) => b.rank - a.rank || a.listing.title.localeCompare(b.listing.title));
    return { company: companyBoards[company], companyId: company, total: matches.length, jobs: matches.map(match => match.listing), rank: matches[0]?.rank ?? 0 };
  }));
  const checked = [];
  const unavailable = [];
  const matches = [];
  for (const [index, result] of results.entries()) {
    const name = companyBoards[companies[index]];
    if (result.status === "rejected") {
      unavailable.push(name);
    } else {
      checked.push(name);
      if (result.value.total) matches.push(result.value);
    }
  }
  matches.sort((a, b) => b.rank - a.rank || b.total - a.total || a.company.localeCompare(b.company));
  return { matches, checked, unavailable };
}
