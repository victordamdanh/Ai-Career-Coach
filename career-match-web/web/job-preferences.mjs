export const states = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

const workTypes = [
  ["Internship", /\bintern(?:ship)?s?\b/],
  ["Entry level", /\b(?:intern(?:ship)?|entry(?: level)?|early career|(?:new|recent|university) grad(?:uate)?|junior|associate|graduate program)\b/],
  ["Mid-level", /\b(?:mid(?: level)?|intermediate)\b/],
  ["Senior", /\b(?:senior|sr|staff|principal|lead)\b/],
  ["Manager", /\b(?:manager|director|head of)\b/],
  ["Director", /\bdirector\b/],
  ["Executive", /\b(?:executive|vice president|vp|chief)\b/],
  ["Full-time", /\bfull time\b/],
  ["Part-time", /\bpart time\b/],
  ["Contract", /\bcontract(?:or)?\b/],
  ["Temporary", /\b(?:temporary|temp)\b/],
  ["Freelance", /\b(?:freelance|freelancer)\b/],
  ["Apprenticeship", /\bapprentice(?:ship)?\b/],
  ["Co-op", /\b(?:co op|coop|cooperative education)\b/],
  ["Seasonal", /\bseasonal\b/],
  ["Volunteer", /\bvolunteer\b/],
];

export const workArrangements = ["Remote", "Hybrid", "In-person"];

export const levelChoices = workTypes.map(([label]) => label);
export const salaryChoices = ["Under $40,000", "$40,000–$59,999", "$60,000–$89,999", "$90,000–$119,999",
  "$120,000–$149,999", "$150,000–$199,999", "$200,000+", "Under $20 per hour", "$20–$29 per hour", "$30–$49 per hour", "$50+ per hour"];

export function preferenceWords(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function containsWords(text, phrase) {
  return (" " + text + " ").includes(" " + phrase + " ");
}

function locationWords(value) {
  return preferenceWords(value)
    .replace(/\b(?:united states(?: of america)?|u s a?|usa|us)\b/g, "united states")
    .replace(/\b(?:new york city|nyc)\b/g, "new york")
    .replace(/\bd c\b/g, "dc");
}

export function matchesJobLevel(preference, description) {
  const term = preferenceWords(preference);
  if (!term || ["any", "any level", "any employment type"].includes(term)) return true;
  const job = preferenceWords(description);
  const legacy = { intern: "Internship", entry: "Entry level" };
  const pattern = workTypes.find(([label]) => preferenceWords(label) === term || label === legacy[term]);
  if (pattern) return pattern[1].test(job);
  return containsWords(job, term);
}

export function matchesJobLocation(preference, location) {
  const choices = preference.split(/\s+(?:or|\/|\|)\s+/i);
  if (choices.length > 1) return choices.some(choice => matchesJobLocation(choice, location));
  const term = locationWords(preference);
  if (!term || term === "any location" || term === "anywhere") return true;
  const job = locationWords(location);
  const cityAndState = preference.trim().match(/^(.+),\s*(.+)$/) ?? preference.trim().match(/^(.+)\s+([A-Z]{2})$/);
  const region = cityAndState ? locationWords(cityAndState[2]) : term;
  const state = Object.keys(states).find(code => code.toLowerCase() === region || preferenceWords(states[code]) === region);
  if (state) {
    const name = preferenceWords(states[state]);
    const city = cityAndState ? locationWords(cityAndState[1]) + " " : "";
    const stateText = state === "WA" ? job.replace(/\bwashington (?:dc|district of columbia)\b/g, "") : job;
    const hasCode = (location.match(/\b[A-Z]{2}\b/g) ?? []).includes(state) ||
      (state === "DC" && /\bD\.\s*C\./i.test(location));
    return containsWords(stateText, city + name) || (hasCode && containsWords(stateText, city + state.toLowerCase()));
  }
  return term.split(" ").every(word => containsWords(job, word));
}

export function salaryTarget(text) {
  const amounts = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/gi)]
    .map(([, amount, thousands]) => Number(amount.replaceAll(",", "")) * (thousands ? 1000 : 1));
  if (!amounts.length || amounts.length > 2 || amounts.some(amount => !Number.isFinite(amount) || amount <= 0)) return null;
  const [first, second] = amounts;
  const hourly = /\b(?:hourly|per hour)\b|\/\s*(?:h|hr|hour)\b/i.test(text);
  const below = /\b(?:under|below|up to|at most|max(?:imum)?)\b/i.test(text);
  const above = /\+|\b(?:from|above|over|minimum|at least|min)\b/i.test(text);
  return { unit: hourly ? "hourly" : "yearly", min: second ? Math.min(first, second) : below ? 0 : first,
    max: second ? Math.max(first, second) : above && !below ? Infinity : first };
}

export function matchesAdvertisedPay(target, salary) {
  if (!target || salary?.currency !== "USD" || salary.unit !== target.unit) return true;
  return (salary.max ?? Infinity) >= target.min && (salary.min ?? 0) <= target.max;
}

export function listingWorkArrangement(listing) {
  const label = preferenceWords([listing.title, listing.location, listing.workplace].filter(Boolean).join(" "));
  const classify = text => /\bhybrid\b/.test(text) ? "Hybrid" :
    /\b(?:remote|work from home|distributed)\b/.test(text) && !/\b(?:not|no) (?:fully )?remote\b/.test(text) ? "Remote" :
    /\b(?:on site|onsite|in person|in office|office based)\b/.test(text) ? "In-person" : "";
  const explicit = classify(label);
  if (explicit) return explicit;
  if (listing.provider === "jobicy") return "Remote";
  const description = preferenceWords(listing.description || "");
  const arrangements = [
    ["Hybrid", /\b(?:hybrid (?:role|position|work|schedule|model|arrangement)|(?:role|position|job) (?:is|will be) (?:a )?hybrid|work (?:in|from) (?:the|our) office \d+ days)\b/],
    ["Remote", /\b(?:fully remote|remote (?:role|position|work arrangement)|(?:role|position|job) (?:is|will be) (?:a )?remote|work from home)\b/],
    ["In-person", /\b(?:on site (?:role|position|work)|onsite (?:role|position|work)|in person (?:role|position|work)|(?:role|position|job) (?:is|will be) (?:an? )?(?:on site|onsite|in person|in office|office based)|(?:work|working) (?:on site|onsite|in person|in the office|in our office))\b/],
  ];
  return arrangements.find(([, pattern]) => pattern.test(description))?.[0] || "";
}

export function matchesWorkArrangement(work, listing) {
  return !work || listingWorkArrangement(listing) === work;
}

export function matchesSearchLocation(place, listing, work = "") {
  if (matchesJobLocation(place, listing.location)) return true;
  const term = preferenceWords(place);
  const stateSelected = Object.entries(states).some(([code, name]) => preferenceWords(code) === term || preferenceWords(name) === term);
  if (work !== "Remote" || !stateSelected) return false;
  // A remote job restricted to a different state is not nationwide. Generic
  // remote postings with no country/state cannot confirm state eligibility.
  const nationwide = /\b(?:US|USA|United States)\b|\bU\.S\.(?:A\.)?/i.test(listing.location);
  const restricted = Object.values(states).some(state => matchesJobLocation(state, listing.location));
  return nationwide && !restricted;
}

export function matchesSearchLevel(level, listing, strict = false) {
  const label = listing.title + " " + (listing.seniority || "");
  if (!strict || !["Entry level", "Mid-level", "Senior"].includes(level)) return matchesJobLevel(level, label);
  const explicit = ["Senior", "Mid-level", "Entry level"].find(choice => matchesJobLevel(choice, label));
  if (explicit) return explicit === level;
  if (["Director", "Executive"].some(choice => matchesJobLevel(choice, label))) return false;
  const matches = [...(listing.description || "").matchAll(/\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\+?\s*years?\s+(?:of\s+)?(?:\w+\s+){0,3}experience\b/gi)];
  if (!matches.length) return false;
  const years = Math.max(...matches.map(match => Number(match[1])));
  const inferred = years < 3 ? "Entry level" : years < 6 ? "Mid-level" : "Senior";
  return level === inferred;
}
