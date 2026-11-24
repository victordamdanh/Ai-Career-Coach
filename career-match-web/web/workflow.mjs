export const careerFlow = [
  { id: "upload", title: "Resume", action: "Upload your resume." },
  { id: "preferences", title: "Preferences", action: "Set the role, location, and level you’re looking for." },
  { id: "review", title: "Resume Review", action: "Score your resume and check which areas to improve." },
  { id: "jobs", title: "Find Jobs", action: "Search the connected company boards and select an opening." },
  { id: "match", title: "Job Match", action: "Compare your resume with the selected posting." },
  { id: "application", title: "Application Draft", action: "Draft and review a note for the selected job." },
  { id: "inbox", title: "Interview Inbox", action: "Check a recruiter reply when you have one." },
  { id: "interview", title: "Interview Practice", action: "Practice a question for the role and review your feedback." },
  { id: "chat", title: "Career Chat", action: "Ask for help with your resume, match, or interview." },
  { id: "profile", title: "Saved Profile and Jobs", action: "Save the profile or selected job you want to keep." },
];

export function nextInFlow(page) {
  const index = careerFlow.findIndex(step => step.id === page);
  if (index >= 0) return careerFlow[index + 1];
}

export function canNavigateWorkflow(from, to) {
  const current = careerFlow.findIndex(step => step.id === from);
  const destination = careerFlow.findIndex(step => step.id === to);
  return destination >= 0 && destination <= current + 1;
}

function recommend(progress) {
  return careerFlow.find(step => !progress?.completed.includes(step.id));
}

export function workflowSummary(progress) {
  const steps = careerFlow.map(step => step.title).join(" → ");
  if (!progress) return "Career workflow: " + steps + ".";
  const completed = careerFlow.filter(step => progress.completed.includes(step.id)).map(step => step.title);
  const current = careerFlow.find(step => step.id === progress.active);
  const next = recommend(progress);
  return "Career workflow: " + steps + ". Current page: " + (current?.title ?? "Resume") +
    ". Completed in this session: " + (completed.join(", ") || "none") +
    ". Suggested next action: " + (next?.action ?? "Review your saved items.");
}

export function workflowHelp(question, progress) {
  const isOverview = /\b(?:workflow|(?:career|the|app) flow|how (?:it|this|the app) works|all (?:the )?steps)\b/i.test(question);
  const isNext = /\b(?:next step|(?:do|go|start) next|what(?:'s| is) next|what comes after|where (?:should|do) i (?:go|start)|how do i get started)\b/i.test(question) || /\bwhat should i do(?: now)?[?.!]*$/i.test(question);
  if (!isOverview && !isNext) return null;
  const after = question.match(/\bafter\s+(?:the\s+)?(.+?)[?.!]*$/i)?.[1].trim().toLowerCase();
  const preceding = careerFlow.find(step => step.title.toLowerCase() === after);
  const next = preceding ? nextInFlow(preceding.id) : recommend(progress);
  const action = next ? next.action : "You’ve reached the end. Review your saved profile and jobs, or return to Resume.";
  return {
    label: "Workflow guide",
    direct: true,
    summary: isOverview ? careerFlow.map(step => step.title).join(" → ") + ". " + action : action,
    links: next ? [{ text: "Open " + next.title, href: "#" + next.id }] : [{ text: "Return to Resume", href: "#upload" }],
  };
}
