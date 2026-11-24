import { resumeProfile } from "./resume-review.mjs?v=2f6b9fac912e";

const categories = ["skills", "experience", "education", "certifications", "projects"];
const statuses = ["match", "partial", "gap"];
const normalize = text => text.replace(/\s+/g, " ").trim().toLowerCase();
const ignored = /\b(?:citizenship|us citizens?|u\.s\. citizens?|visa sponsorship|work authorization|equal opportunity|reasonable accommodation|sexual orientation|protected veteran|security clearance)\b/i;
const nonQualification = /^(?:about (?:us|the company|our company|the team)|salary|pay range|compensation|(?:we offer|our) benefits|apply (?:now|here)|how to apply|privacy notice)\b/i;
const qualification = /\b(?:experience|skills?|proficien\w+|qualifications?|knowledge|familiar\w*|understanding|ability|able to|required|preferred|degree|certificat\w+|licen[cs]\w+|years?|develop\w*|build\w*|design\w*|analy[sz]\w*|manage\w*|collaborat\w+)\b/i;
const generic = new Set("about ability able and apply are build built can company demonstrate demonstrated develop eligible experience familiar for from have knowledge must preferred proficient requirement required skill skills strong the their this through using with work years your".split(" "));

function selectWithinBudget(entries, size, limit) {
  const selected = [];
  let used = 0;
  for (const entry of entries) {
    if (selected.length >= limit || used + entry.text.length > size) continue;
    selected.push(entry);
    used += entry.text.length;
  }
  return selected;
}

export function sourceExcerpts(resume, job) {
  function collect(text, prefix) {
    const entries = [];
    let priority = "required";
    for (const line of text.split(/\r?\n/)) {
      const clean = line.trim().replace(/^[•●▪*–—-]\s*/, "");
      if (prefix === "J" && /^(?:(?:minimum|basic|required|preferred|desired|additional)\s+)?(?:qualifications|requirements|skills)\s*:?$/i.test(clean)) {
        priority = /^(?:preferred|desired|additional)/i.test(clean) ? "preferred" : "required";
        continue;
      }
      if (prefix === "J" && (ignored.test(clean) || nonQualification.test(clean))) continue;
      for (const part of clean.split(/(?<=[.!?])\s+(?=[A-Z])|;\s+|\s+•\s*/)) {
        const end = part.slice(0, 241).lastIndexOf(" ");
        const quote = part.length > 240 ? part.slice(0, end > 100 ? end : 240) : part.trim();
        if (quote.length < 10) continue;
        entries.push({ id: prefix + (entries.length + 1), text: quote, priority: /\b(?:preferred|nice to have|a plus)\b/i.test(quote) ? "preferred" : priority });
      }
    }
    return entries;
  }

  const jobEntries = collect(job, "J");
  const ranked = [
    ...jobEntries.filter(row => qualification.test(row.text)),
    ...jobEntries.filter(row => !qualification.test(row.text)),
  ];
  return {
    job: selectWithinBudget(ranked, 2450, 20),
    resume: selectWithinBudget(collect(resume, "R"), 2700, 26),
  };
}

export function modelRows(raw, sources) {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const { rows } = JSON.parse(json);
  if (!Array.isArray(rows)) return [];
  const covered = new Set();
  const checked = [];
  for (const row of rows.slice(0, 12)) {
    if (!Array.isArray(row)) continue;
    const [jobId, category, status, priority, resumeId] = row;
    const posting = sources.job.find(entry => entry.id === jobId);
    if (!posting || covered.has(jobId) || !categories.includes(category) || !statuses.includes(status)) continue;
    const evidence = sources.resume.find(entry => entry.id === resumeId);
    if (status !== "gap" && !evidence) continue;
    checked.push({
      category, status, requirement: posting.text, jobQuote: posting.text,
      priority: priority === "preferred" || posting.priority === "preferred" ? "preferred" : "required",
      evidence: status === "gap" ? "" : evidence.text,
    });
    covered.add(jobId);
  }
  return checked;
}

const keywords = text => new Set((normalize(text).match(/[a-z][a-z0-9+#]{2,}/g) ?? []).filter(word => !generic.has(word)));

function evidenceCategory(text) {
  if (/\b(certifica\w+|licen[cs]\w+)\b/i.test(text)) return "certifications";
  if (/\b(degree|bachelor|master|diploma|phd|education)\b/i.test(text)) return "education";
  if (/\b(years?|experience|worked|employment)\b/i.test(text)) return "experience";
  if (/\b(projects?|portfolio)\b/i.test(text)) return "projects";
  return "skills";
}

export function fallbackRows(sources) {
  const candidates = sources.job.filter(posting => qualification.test(posting.text) ||
    resumeProfile(posting.text).skills.length || /^\s*(?:[A-Z][A-Za-z0-9+#.-]*\s*){2,4}$/.test(posting.text));
  const postings = (candidates.length ? candidates : sources.job).slice(0, 6);
  const evidence = sources.resume.filter(row => !/\b(?:no|not|without|lack)\b.{0,24}\b(?:experience|knowledge|skills)\b|\b(?:never used|not familiar)\b/i.test(row.text))
    .map(row => ({ ...row, terms: keywords(row.text), skills: resumeProfile(row.text).skills }));
  return postings.map(posting => {
    const terms = keywords(posting.text);
    const skills = resumeProfile(posting.text).skills;
    let best;
    let strength = 0;
    for (const row of evidence) {
      const exact = normalize(row.text) === normalize(posting.text);
      const shared = [...terms].filter(word => row.terms.has(word)).length;
      const sharedSkills = skills.filter(skill => row.skills.includes(skill)).length;
      const overlap = sharedSkills ? 8 * sharedSkills + shared : shared >= 2 && shared / terms.size >= .6 ? shared : 0;
      const weight = exact ? 100 : Math.min(99, overlap);
      if (weight > strength) { best = row; strength = weight; }
    }
    return {
      category: evidenceCategory(posting.text), priority: posting.priority,
      status: strength === 100 ? "match" : best ? "partial" : "gap",
      requirement: posting.text, jobQuote: posting.text, evidence: best?.text ?? "",
    };
  });
}

export function matchActions(rows) {
  const actions = rows.map(row => {
    const short = row.requirement.length > 105 ? row.requirement.slice(0, 102).trimEnd() + "…" : row.requirement;
    const qualificationText = "“" + short + "”";
    if (row.status === "gap") return "Check whether your experience supports " + qualificationText + " and add an example if it does.";
    if (row.status === "partial") return "Make the connection to " + qualificationText + " clearer with a specific example.";
    return "Use your supporting resume example for " + qualificationText + " when preparing your application.";
  });
  return [...new Set([...actions,
    "Read the official posting for qualifications beyond the excerpts shown here.",
    "Prioritize required qualifications before preferred qualifications.",
    "For each claim, prepare a concrete example that shows your contribution.",
    "Review your resume before sending it to make sure every claim is accurate.",
    "Save the posting so you can refer to the wording while preparing.",
  ])].slice(0, 5);
}
