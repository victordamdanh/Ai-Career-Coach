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

export const levelChoices = workTypes.map(([label]) => label);
export const salaryChoices = ["Under $40,000", "$40,000–$59,999", "$60,000–$89,999", "$90,000–$119,999",
  "$120,000–$149,999", "$150,000–$199,999", "$200,000+", "Under $20 per hour", "$20–$29 per hour", "$30–$49 per hour", "$50+ per hour"];

export function preferenceWords(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function containsWords(text, phrase) {
  return (" " + text + " ").includes(" " + phrase + " ");
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
  const term = preferenceWords(preference);
  if (!term || term === "any location" || term === "anywhere") return true;
  const job = preferenceWords(location);
  const cityAndState = preference.trim().match(/^(.+),\s*(.+)$/);
  const region = cityAndState ? preferenceWords(cityAndState[2]) : term;
  const state = Object.keys(states).find(code => code.toLowerCase() === region || preferenceWords(states[code]) === region);
  if (state) {
    const regionFound = containsWords(job, preferenceWords(states[state])) || (location.match(/\b[A-Z]{2}\b/g) ?? []).includes(state);
    return regionFound && (!cityAndState || containsWords(job, preferenceWords(cityAndState[1])));
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
