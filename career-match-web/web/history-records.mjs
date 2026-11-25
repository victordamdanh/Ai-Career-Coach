export const historyId = value => typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
export function historyText(value, max, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error("Check the history record fields.");
  return value.trim();
}
export function historyLink(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.href.length <= 800 ? url.href : "";
  } catch { return ""; }
}
export function normalizeHistory(input) {
  if (!input || !historyId(input.id) || !["resume","interview"].includes(input.kind) ||
      typeof input.createdAt !== "string" || !Number.isFinite(Date.parse(input.createdAt))) throw new Error("Invalid history record.");
  const p = input.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Invalid history details.");
  const record = { id: input.id, kind: input.kind, name: historyText(input.name, 100, true), createdAt: new Date(input.createdAt).toISOString() };
  if (input.kind === "resume") record.payload = { text: historyText(p.text, 14000, true), filename: historyText(p.filename ?? "", 300) };
  else {
    if (!Number.isInteger(p.score) || p.score < 0 || p.score > 100 ||
        !Array.isArray(p.turns) || !p.turns.length || p.turns.length > 3 ||
        !Array.isArray(p.criteria) || p.criteria.length > 5 || !Array.isArray(p.feedback) || p.feedback.length > 12) throw new Error("Invalid interview feedback.");
    record.payload = {
      role: historyText(p.role ?? "", 300), company: historyText(p.company ?? "", 100),
      level: historyText(p.level ?? "", 100), sourceUrl: historyLink(p.sourceUrl),
      resumeName: historyText(p.resumeName ?? "", 300), resumeId: historyId(p.resumeId) ? p.resumeId : null,
      score: p.score, mode: historyText(p.mode ?? "", 100),
      turns: p.turns.map(turn => ({ question: historyText(turn.question, 500, true), answer: historyText(turn.answer, 8000, true), truncated: !!turn.truncated })),
      criteria: p.criteria.map(item => {
        if (!Number.isInteger(item.points) || item.points < 0 || item.points > 20) throw new Error("Invalid interview score.");
        return { name: historyText(item.name, 100, true), points: item.points };
      }),
      feedback: p.feedback.map(note => historyText(note, 2000, true)),
    };
  }
  if (new TextEncoder().encode(JSON.stringify(record.payload)).length > 100000) throw new Error("The history record is too long.");
  return record;
}
