export const resumeLimit = 14_000;

const tracks = [
  { skills: ["SQL", "Python", "Excel", "Tableau", "Power BI", "business analytics", "data visualization"], roles: ["data analyst", "business analyst", "business intelligence", "analytics", "data engineer"] },
  { skills: ["React", "JavaScript", "TypeScript", "Java", "software engineering", "REST API", "Node.js", "HTML", "CSS"], roles: ["software engineer", "web developer", "frontend", "front end", "full stack", "backend", "back end"] },
  { skills: ["machine learning", "PyTorch", "TensorFlow", "data science", "natural language processing", "statistics"], roles: ["machine learning", "data scientist", "data science", "applied scientist"] },
  { skills: ["accounting", "financial modeling", "budgeting", "finance", "bookkeeping", "financial analysis"], roles: ["financial analyst", "finance", "accountant", "accounting"] },
  { skills: ["customer service", "sales", "customer success", "inventory", "retail", "scheduling"], roles: ["customer support", "customer success", "sales", "operations", "account manager"] },
  { skills: ["marketing", "content writing", "social media", "SEO", "communications"], roles: ["marketing", "content", "communications", "community"] },
  { skills: ["project management", "product management", "operations", "Scrum", "Jira", "event coordination"], roles: ["project manager", "program manager", "project coordinator", "product manager", "operations"] },
  { skills: ["Figma", "UX", "graphic design", "Adobe", "prototyping"], roles: ["designer", "researcher", "UX", "design"] },
  { skills: ["network administration", "cloud computing", "AWS", "cybersecurity", "help desk", "technical support"], roles: ["IT support", "network engineer", "security engineer", "cloud engineer", "technical support"] },
];

const words = value => value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
const normalize = value => " " + words(value).join(" ") + " ";
const includes = (text, phrase) => text.includes(normalize(phrase));
const headings = /^(?:(?:relevant|professional|work|technical|academic|selected|core|additional|volunteer)\s+)*(experience|education|skills|projects|activities|certifications|summary|profile|awards|publications|leadership|service)\b/i;
const action = /\b(built|created|organized|coordinated|managed|led|designed|improved|wrote|reviewed|shipped|served|trained|tracked|analyzed|developed|taught|supported|prepared|processed|maintained|assisted|reduced|grew|presented|collaborated|launched|researched|implemented|negotiated|delivered|supervised|cleaned|increased|reconciled|budgeted)\b/i;
const measure = /\b\d[\d,.]*\s*(?:%|percent|users?\b|surveys?\b|students?\b|hours?\b|minutes?\b|clients?\b|customers?\b|records?\b|events?\b|reports?\b|locations?\b|items?\b|documents?\b)|\$\s*\d/i;
const stop = new Set(["with", "and", "the", "for", "who", "from", "that", "you", "your", "our", "this", "have", "work", "will", "are", "role", "job", "experience", "skills", "preferred", "required", "responsibilities", "qualifications"]);

export function resumeProfile(resume) {
  const normalized = normalize(resume);
  const matched = tracks.map(track => ({
    roles: track.roles,
    skills: track.skills.filter(skill => includes(normalized, skill)),
  })).filter(track => track.skills.length).sort((a, b) => b.skills.length - a.skills.length);
  return {
    skills: [...new Set(matched.flatMap(track => track.skills))],
    roles: [...new Set(matched.slice(0, 4).flatMap(track => track.roles))].slice(0, 16),
  };
}

export function resumeExcerpt(resume, focus = "", budget = 2600) {
  if (resume.length <= budget) return resume;
  const focusWords = new Set(words(focus).filter(word => word.length > 2 && !stop.has(word)));
  const excerpts = resume.match(/[^\r\n]{1,300}/g) ?? [];
  const ranked = excerpts.map((line, index) => ({
    line, index, priority: [...new Set(words(line).filter(word => focusWords.has(word)))].length * 3
      + Number(headings.test(line.trim())) + Number(action.test(line)) + 2 * Number(index < 5),
  })).sort((a, b) => b.priority - a.priority || a.index - b.index);
  const selected = [];
  let length = 0;
  for (const part of ranked) {
    if (length + part.line.length + 1 > budget) continue;
    selected.push(part);
    length += part.line.length + 1;
  }
  return selected.sort((a, b) => a.index - b.index).map(({ line }) => line).join("\n");
}

export function reviewResume(resume, target = "") {
  const lines = resume.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const sectionCount = new Set(lines.map(line => line.match(headings)?.[1].toLowerCase()).filter(Boolean)).size;
  const actions = lines.filter(line => action.test(line));
  const measured = lines.filter(line => measure.test(line));
  const profile = resumeProfile(resume);
  const hasSkillSection = lines.some(line => /^\s*(?:(?:technical|core)\s+)?skills\b/i.test(line));
  const concise = lines.filter(line => line.length <= 180).length / Math.max(1, lines.length);
  const focus = [...new Set(words(target).filter(word => word.length > 2 && !stop.has(word)))];
  const evidenceWords = new Set(words(resume));
  const overlap = focus.filter(word => evidenceWords.has(word)).length;
  const score = (name, points, explanation) => ({ name, points: Math.min(20, Math.round(points)), explanation });
  const criteria = [
    score("Organization", 8 + Math.min(sectionCount, 3) * 3 + (lines.length > 5 ? 3 : 0),
      sectionCount >= 2 ? "The text has recognizable sections, which help readers navigate the resume." : "Add clear labels for relevant sections such as Experience, Education, or Projects."),
    score("Clarity", 8 + concise * 7 + Math.min(actions.length, 5),
      concise >= 0.7 ? "Most lines are short enough to scan quickly." : "Break longer descriptions into short bullets focused on one contribution each."),
    score("Impact", 6 + Math.min(actions.length, 4) * 2 + Math.min(measured.length, 3) * 2,
      measured.length ? "The text includes quantities that can show the scope or result of your work." : "Where you can verify it, add an outcome, scope, or result to an experience or project."),
    score("Relevance", focus.length ? 7 + 13 * overlap / focus.length : 10 + Math.min(actions.length + profile.skills.length, 10),
      focus.length ? "This checks how much of the target role’s language is supported by your resume text." : "This is a general readiness check. Add a job title or description for a targeted comparison."),
    score("Skills", 7 + (hasSkillSection ? 4 : 0) + Math.min(profile.skills.length, 5) + Math.min(actions.length, 4),
      profile.skills.length ? "Examples of skills mentioned include " + profile.skills.slice(0, 5).join(", ") + "." : "Name the tools, methods, or responsibilities you used and connect them to a specific example."),
  ];
  return { criteria, total: criteria.reduce((sum, item) => sum + item.points, 0), profile };
}
