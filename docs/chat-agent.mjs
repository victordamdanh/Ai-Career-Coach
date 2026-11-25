import { resumeProfile, reviewResume } from "./resume-review.mjs?v=3ea1b7ee0216";
import { workflowHelp } from "./workflow.mjs?v=3ea1b7ee0216";

function chooseTool(question) {
  if (/\b(?:compare|fit|align|qualification|match report)\b/i.test(question) &&
    /\b(?:job|role|posting|resume|qualification|match report)\b/i.test(question)) return "match";
  if (/\b(?:find|search|show|list|look for|recommend|open)\b/i.test(question) &&
    /\b(?:jobs?|roles?|openings?|positions?|internships?|companies|hiring)\b/i.test(question)) return "jobs";
  if (/\b(?:review|score|check|assess|evaluate|feedback)\b/i.test(question) &&
    /\b(?:resume|résumé|cv)\b/i.test(question)) return "resume";
  return null;
}

function titleFromQuestion(question) {
  const title = question.match(/\b(?:find|show|search(?: for)?|list|recommend|look for)\s+(?:me\s+)?(?:some\s+|an?\s+)?(.{2,65}?)\s+(?:jobs?|roles?|positions?|openings?|internships?)\b/i)?.[1];
  if (!title || /^(?:my|all|open|current|new|remote|entry.level|available|matching|suitable|actual|live)\b/i.test(title)) return "";
  return title.trim().replace(/[^a-zA-Z0-9 +/&-]/g, "");
}

export function createCareerChatAgent(request) {
  return async (question, context, progress) => {
    const guide = workflowHelp(question, progress);
    if (guide) return guide;
    switch (chooseTool(question)) {
      case "resume": {
        if (!context?.resume || context.resume.trim().length < 20) return {
          label: "Resume review",
          summary: "No resume was included. The applicant can upload a resume and check Include my resume and job before asking for personalized review.",
          links: [{ text: "Upload a resume", href: "#upload" }],
        };
        const report = context.review ?? reviewResume(context.resume, context.job || context.role);
        return {
          label: "Resume review",
          summary: "Resume quality checklist scored " + report.total + "/100. " + report.criteria
            .map(({ name, points, explanation }) => name + " " + points + "/20. " + explanation).join(" "),
          links: [{ text: "Open Resume Review", href: "#review" }],
        };
      }
      case "jobs": {
        const profile = resumeProfile((context?.resume ?? "") + "\n" + question);
        const roles = [...new Set([titleFromQuestion(question), context?.role, ...profile.roles].filter(Boolean))].slice(0, 16);
        if (!roles.length) return {
          label: "Job search",
          direct: true,
          summary: "Which job title should I look for? You can also enable resume details to search using your experience.",
          links: [{ text: "Set job preferences", href: "#preferences" }],
        };
        const params = new URLSearchParams({ place: context?.place ?? "", level: context?.level ?? "", pay: context?.pay ?? "" });
        roles.forEach(role => params.append("role", role));
        try {
          const { matches, checked } = await request("recommend?" + params);
          const listings = matches.slice(0, 4).map(group => group.jobs[0]).filter(Boolean);
          return {
            label: "Live job search",
            direct: true,
            summary: "Checked " + checked.length + " live job sources and found " + matches.length + " matching companies. " +
              (listings.length ? "Examples: " + listings.map(job => job.title + " at " + job.company + " (" + job.location + ")").join("; ") + "." : "No matching postings were returned for these titles and filters."),
            links: [...listings.map(job => ({ text: job.title + " · " + job.company, href: job.url })),
              { text: "Open Find Jobs", href: "#jobs" }],
          };
        } catch {
          return { label: "Live job search", direct: true, summary: "I couldn’t retrieve current postings. Try Find Jobs to search again.", links: [{ text: "Try Find Jobs", href: "#jobs" }] };
        }
      }
      case "match": {
        const report = context?.match;
        const rows = report?.rows.slice(0, 5) ?? [];
        return {
          label: "Job match report",
          summary: rows.length
            ? (report.mode === "source" ? "Source-based comparison scored " : "Current match scored ") + report.rubric.score + "%. Qualifications shown are " + rows.map(row => row.requirement + " (" + row.status + ")").join("; ") + "."
            : "No match report was included. Ask the user to run Job Match with their resume and selected posting first.",
          links: [{ text: "Open Job Match", href: "#match" }],
        };
      }
      default:
        return null;
    }
  };
}
