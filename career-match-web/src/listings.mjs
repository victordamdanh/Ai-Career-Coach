const companies = { cloudflare: "Cloudflare", figma: "Figma", databricks: "Databricks" };
const boardCache = new Map();
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

export async function fetchListings(company, phrase, fetcher = fetch) {
  if (!Object.hasOwn(companies, company)) throw new Error("Choose a supported company.");
  let board = boardCache.get(company);
  if (!board || board.expires < Date.now()) {
    const response = await fetcher("https://boards-api.greenhouse.io/v1/boards/" + company + "/jobs?content=true",
      { signal: AbortSignal.timeout(9000), headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("The company career board is unavailable.");
    const { jobs } = await response.json();
    if (!Array.isArray(jobs)) throw new Error("The company career board returned an unexpected response.");
    board = { jobs, expires: Date.now() + 60_000 };
    boardCache.set(company, board);
  }

  const query = phrase.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const found = board.jobs.filter(job => {
    const terms = [job.title, job.location?.name, ...(job.departments ?? []).map(dept => dept.name)]
      .join(" ").toLowerCase();
    return query.every(word => terms.includes(word));
  });
  const jobs = [];
  for (const job of found.slice(0, 10)) {
    if (!job.absolute_url || typeof job.content !== "string") continue;
    const official = new URL(job.absolute_url);
    if (official.protocol !== "https:" || official.username || official.password) continue;
    const description = jobText(job.content);
    jobs.push({
      id: job.id, title: job.title, location: job.location?.name || "See official posting",
      company: companies[company], url: official.href, description: description.slice(0, 18000),
      excerpt: excerpt(description),
    });
  }
  return { company: companies[company], total: found.length, jobs };
}
