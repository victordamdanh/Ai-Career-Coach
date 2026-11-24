import { matchesAdvertisedPay, matchesJobLevel, matchesJobLocation, preferenceWords, salaryTarget, states } from "./job-preferences.mjs?v=f95502689cbe";

export const companyBoards = {
  anthropic: "Anthropic", airbnb: "Airbnb", cloudflare: "Cloudflare", databricks: "Databricks",
  discord: "Discord", dropbox: "Dropbox", figma: "Figma", reddit: "Reddit", roblox: "Roblox", stripe: "Stripe",
  asana: "Asana", chime: "Chime", duolingo: "Duolingo", elastic: "Elastic", gitlab: "GitLab",
  instacart: "Instacart", lyft: "Lyft", mongodb: "MongoDB", twilio: "Twilio",
};
const boardCache = new Map();
const remoteCache = new Map();
const remoteEndpoint = "https://jobicy.com/api/jobs";
const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", ndash: "–", mdash: "—" };
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
  const metadata = Array.isArray(job.metadata) ? job.metadata : [];
  const seniority = metadata.filter(item => /\b(?:employment type|job type|seniority|experience level)\b/i.test(item?.name ?? ""))
    .flatMap(item => item.value).filter(value => typeof value === "string").join(" ");
  const listing = { id: job.id, title: job.title, location: job.location?.name || "See official posting",
    company: companyBoards[company], companyId: company, url: official.href, seniority };
  if (typeof job.content === "string") {
    const description = jobText(job.content);
    return { ...listing, description: description.slice(0, 18_000), excerpt: excerpt(description) };
  }
  return listing;
}

export async function fetchListings(company, phrase, fetcher = fetch, { place = "", level = "", pay = "" } = {}) {
  const entries = await boardJobs(company, true, fetcher);
  const query = phrase.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const targetPay = salaryTarget(pay);
  const jobs = [];
  for (const entry of entries) {
    const listing = toListing(entry, company);
    if (!listing?.description || !meetsPreferences(listing, place, level, targetPay)) continue;
    const terms = [listing.title, listing.location, ...(entry.departments ?? []).map(dept => dept.name)]
      .join(" ").toLowerCase();
    if (query.every(word => terms.includes(word))) jobs.push(listing);
  }
  return { company: companyBoards[company], total: jobs.length, jobs };
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

const titleKey = text => " " + preferenceWords(text) + " ";
const roleKey = text => titleKey(text).replace(/\b(front|back) end\b/g, "$1end").replace(/\bfull stack\b/g, "fullstack");
const relatedTitles = [
  ["data analyst", "analytics analyst", "business intelligence analyst", "reporting analyst", "bi analyst", "business analyst"],
  ["data engineer", "analytics engineer", "data warehouse engineer", "data platform engineer"],
  ["software engineer", "software developer", "application developer", "software development engineer"],
  ["frontend developer", "frontend engineer", "ui developer"],
  ["backend developer", "backend engineer", "server side engineer"],
  ["ux designer", "user experience designer", "product designer", "interaction designer"],
  ["customer support representative", "customer service representative", "customer support specialist", "customer service associate"],
  ["administrative assistant", "office assistant", "administrative coordinator"],
].map(group => group.map(roleKey));

function matchesTitle(title, role) {
  if (title.includes(role)) return true;
  const words = role.trim().split(" ");
  return words.length > 1 && words.every(word => title.includes(" " + word + " "));
}

const stateNames = Object.entries(states);
function remoteOrUS(location) {
  return matchesJobLocation("Remote", location) || /\b(?:US|USA|U\.S\.|United States)\b/i.test(location) ||
    stateNames.some(([code, name]) => matchesJobLocation(code, location) || matchesJobLocation(name, location));
}

function meetsPreferences(listing, place, level, targetPay) {
  const placeOk = typeof place === "function" ? place(listing.location) : matchesJobLocation(place, listing.location);
  return placeOk &&
    matchesJobLevel(level, listing.title + " " + (listing.seniority || "")) &&
    matchesAdvertisedPay(targetPay, listing.salary);
}

async function remotePage(params, fetcher) {
  const url = remoteEndpoint + "?" + params;
  const cached = remoteCache.get(url);
  if (cached?.expires > Date.now()) return cached.data;
  const response = await fetcher(url, { signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error("The remote job feed is unavailable.");
  const data = await response.json();
  if (!Array.isArray(data.jobs) || data.success === false) throw new Error("The remote job feed returned an unexpected response.");
  if (remoteCache.size >= 32) remoteCache.delete(remoteCache.keys().next().value);
  remoteCache.set(url, { data, expires: Date.now() + 60 * 60_000 });
  return data;
}

function toRemoteListing(job) {
  if (!Number.isSafeInteger(job.id) || job.id < 1 || typeof job.jobTitle !== "string" ||
    typeof job.companyName !== "string" || typeof job.jobDescription !== "string") return null;
  let url;
  try { url = new URL(job.url); } catch { return null; }
  if (url.origin !== "https://jobicy.com" || url.username || url.password || !url.pathname.startsWith("/jobs/")) return null;
  const description = jobText(job.jobDescription);
  if (description.length < 20) return null;
  const location = ["Remote", typeof job.jobGeo === "string" && job.jobGeo.trim()].filter(Boolean).join(" · ");
  const seniority = [job.jobLevel, ...(Array.isArray(job.jobType) ? job.jobType : [])].filter(value => typeof value === "string").join(" ");
  const min = Number.isFinite(job.salaryMin) && job.salaryMin > 0 ? job.salaryMin : null;
  const max = Number.isFinite(job.salaryMax) && job.salaryMax > 0 ? job.salaryMax : null;
  const unit = job.salaryPeriod === "annual" ? "yearly" : job.salaryPeriod;
  const salary = min || max ? { min, max, unit, currency: job.salaryCurrency } : undefined;
  return { id: job.id, title: decode(job.jobTitle).trim(), company: decode(job.companyName).trim(), url: job.url, location, seniority,
    provider: "jobicy", salary, description: description.slice(0, 18_000), excerpt: excerpt(description) };
}

async function remoteListings(roles, fetcher) {
  const terms = roles.slice(0, 6).map(role => role.trim().match(/\b(?!(?:senior|junior|staff|lead|principal|entry|intern)\b)[a-z]{3,}\b/i)?.[0]?.toLowerCase());
  const tags = [...new Set(terms.filter(Boolean))].slice(0, 2);
  const feeds = await Promise.allSettled((tags.length ? tags : [""]).map(async tag => {
    const params = new URLSearchParams({ count: "100" });
    if (tag) params.set("tag", tag);
    const first = await remotePage(params, fetcher);
    if (!first.nextCursor || typeof first.nextCursor !== "string") return first.jobs;
    params.set("cursor", first.nextCursor);
    try {
      return first.jobs.concat((await remotePage(params, fetcher)).jobs);
    } catch {
      return first.jobs;
    }
  }));
  if (feeds.every(feed => feed.status === "rejected")) throw new Error("The remote job feed is unavailable.");
  return feeds.flatMap(feed => feed.status === "fulfilled" ? feed.value : []).map(toRemoteListing).filter(Boolean);
}

export async function checkRemoteListing(id, fetcher = fetch) {
  if (!/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error("Choose a valid listing.");
  const response = await fetcher(remoteEndpoint + "/status?" + new URLSearchParams({ ids: id }), { signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error("The posting status could not be checked.");
  const { jobs } = await response.json();
  return Array.isArray(jobs) ? jobs.find(job => job.id === Number(id))?.status ?? "unknown" : "unknown";
}

export async function recommendCompanies({ roles, place, level, pay = "", skills = [], includeRemote = false }, fetcher = fetch) {
  const query = [...new Set(roles.flatMap(role => [role, role.replace(/\s*\([^()]+\)\s*$/, "")]).map(roleKey))].filter(role => role.trim());
  const related = [...new Set(relatedTitles.filter(group => group.some(role => query.some(term => matchesTitle(term, role)))).flat())];
  const targetPay = salaryTarget(pay);
  const sources = Object.entries(companyBoards).map(([company, name]) => [name, async () => {
    const jobs = await boardJobs(company, false, fetcher);
    return jobs.map(job => toListing(job, company)).filter(Boolean);
  }]);
  if (includeRemote) sources.push(["Jobicy", () => remoteListings(roles, fetcher)]);
  const results = await Promise.allSettled(sources.map(([, load]) => load()));
  const checked = [];
  const unavailable = [];
  const candidates = [];
  for (const [index, result] of results.entries()) {
    const name = sources[index][0];
    if (result.status === "rejected") {
      unavailable.push(name);
      continue;
    }
    checked.push(name);
    for (const listing of result.value) {
      const title = roleKey(listing.title);
      const directRank = query.reduce((total, role, position) => matchesTitle(title, role) ? total + query.length - position : total, 0);
      const rank = directRank ? directRank + 1 : Number(related.some(role => matchesTitle(title, role)));
      if (query.length && !rank) continue;
      candidates.push({ listing, rank });
    }
  }
  // Keep the chosen filters when anything matches them. If nothing does, relax the
  // location first, then level and pay, and report which filters were relaxed.
  // Remote and U.S. openings come before worldwide ones.
  const tiers = [{ place, level, targetPay, relaxed: [] }];
  const loosened = [...(place ? ["location"] : []), ...(level ? ["level"] : []), ...(targetPay ? ["salary"] : [])];
  if (place) {
    tiers.push({ place: remoteOrUS, level, targetPay, relaxed: ["location"], widened: "remote or U.S." });
    tiers.push({ place: "", level, targetPay, relaxed: ["location"], widened: "any location" });
  }
  if (level || targetPay) {
    tiers.push({ place: remoteOrUS, level: "", targetPay: undefined, relaxed: loosened, widened: "remote or U.S." });
    tiers.push({ place: "", level: "", targetPay: undefined, relaxed: loosened, widened: "any location" });
  }
  let companies = new Map();
  let relaxed = [];
  let widened;
  for (const tier of tiers) {
    companies = new Map();
    for (const { listing, rank } of candidates) {
      if (!meetsPreferences(listing, tier.place, tier.level, tier.targetPay)) continue;
      const text = skills.length ? titleKey(listing.title + " " + (listing.description ?? "")) : "";
      const matchedSkills = skills.filter(skill => text.includes(titleKey(skill)));
      const companyKey = titleKey(listing.company);
      const listingKey = (listing.provider ?? "greenhouse") + "/" + listing.id;
      const openings = companies.get(companyKey) ?? new Map();
      if (!openings.has(listingKey)) openings.set(listingKey, { listing: { ...listing, matchedSkills }, rank: rank * 10 + matchedSkills.length });
      companies.set(companyKey, openings);
    }
    relaxed = tier.relaxed;
    widened = tier.widened;
    if (companies.size) break;
  }
  if (!companies.size) {
    relaxed = [];
    widened = undefined;
  }
  const matches = [...companies.values()].map(openings => {
    const rows = [...openings.values()].sort((a, b) => b.rank - a.rank || a.listing.title.localeCompare(b.listing.title));
    return { company: rows[0].listing.company, jobs: rows.map(row => row.listing), rank: rows[0].rank, total: rows.length };
  });
  matches.sort((a, b) => b.rank - a.rank || b.total - a.total || a.company.localeCompare(b.company));
  return { matches, checked, unavailable, relaxed, widened };
}
