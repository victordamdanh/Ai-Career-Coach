import { preferenceWords, states, workArrangements } from "./job-preferences.mjs?v=ab5fd24bb93f";

const departmentRoles = {
  tech: ["Technology & IT", [
    ["Data Analyst", "sql,excel,tableau,power bi,data analysis,dashboards,reporting"],
    ["Software Engineer", "software engineering,java,python,programming,apis,software development"],
    ["Frontend Developer", "react,javascript,typescript,html,css,frontend,front end"],
    ["Backend Developer", "backend,back end,node.js,fastapi,rest api,databases,server"],
    ["Data Engineer", "etl,data pipelines,data warehouse,spark,sql,airflow"],
    ["Data Scientist", "statistics,data science,machine learning,python,pandas,modeling"],
    ["Machine Learning Engineer", "machine learning,deep learning,pytorch,tensorflow,nlp,model deployment"],
    ["IT Support Specialist", "help desk,technical support,troubleshooting,service desk"],
    ["Systems Analyst", "systems analysis,requirements gathering,business systems,process mapping"],
    ["Network Engineer", "network administration,tcp,networking,cisco,routing"],
    ["Cloud Engineer", "aws,azure,gcp,cloud computing,terraform,kubernetes"],
    ["Cybersecurity Analyst", "cybersecurity,security operations,security analysis,siem,risk"],
  ]],
  business: ["Business & operations", [
    ["Business Analyst", "business analysis,requirements gathering,process improvement,excel,sql"],
    ["Operations Analyst", "operations,process improvement,inventory,performance metrics,reporting"],
    ["Project Coordinator", "project coordination,scheduling,project management,jira,stakeholders"],
    ["Project Manager", "project manager,project management,budgeting,stakeholder management,scrum"],
    ["Program Coordinator", "program coordination,events,program management,scheduling"],
    ["Product Manager", "product management,roadmap,product strategy,user research,prioritization"],
    ["Management Analyst", "consulting,analysis,business strategy,process improvement"],
    ["Administrative Assistant", "administration,scheduling,office management,documentation"],
  ]],
  hr: ["Human resources", [
    ["HR Coordinator", "human resources,hr,employee records,onboarding,hris"],
    ["Recruiter", "recruiting,recruitment,interviewing,talent acquisition,sourcing"],
    ["HR Generalist", "employee relations,benefits,hr policies,hris,human resources"],
    ["Learning and Development Specialist", "training,learning and development,facilitation,instructional design"],
    ["Payroll Specialist", "payroll,timesheets,compensation,employee records"],
  ]],
  sales: ["Sales & business development", [
    ["Sales Development Representative", "sales,prospecting,outreach,lead generation,cold calling"],
    ["Account Executive", "account executive,sales,closing,deals,pipeline,crm"],
    ["Account Manager", "account management,client relationships,renewals,sales"],
    ["Business Development Representative", "business development,partnerships,lead generation,prospecting"],
    ["Sales Operations Analyst", "sales operations,crm,salesforce,reporting,excel"],
  ]],
  marketing: ["Marketing & communications", [
    ["Marketing Coordinator", "marketing,campaigns,events,communications,promotion"],
    ["Digital Marketing Specialist", "digital marketing,seo,sem,google analytics,paid media"],
    ["Content Specialist", "content writing,copywriting,editorial,content strategy"],
    ["Social Media Specialist", "social media,community management,content creation"],
    ["Marketing Analyst", "marketing analytics,market research,analytics,excel,reporting"],
  ]],
  finance: ["Finance & accounting", [
    ["Financial Analyst", "financial analysis,finance,financial modeling,budgeting,excel"],
    ["Accountant", "accounting,bookkeeping,financial statements,accounts payable,reconciliation"],
    ["Budget Analyst", "budgeting,forecasting,budget analysis,financial planning"],
    ["Risk Analyst", "risk management,risk analysis,compliance,statistics,financial risk"],
    ["Audit Associate", "audit,internal controls,accounting,assurance"],
  ]],
  design: ["Design & creative", [
    ["UX Designer", "ux,user experience,figma,wireframes,prototyping,usability"],
    ["Product Designer", "product design,design systems,figma,prototyping,user research"],
    ["Graphic Designer", "graphic design,adobe,illustrator,photoshop,visual design"],
    ["UX Researcher", "user research,interviews,usability,research,qualitative methods"],
  ]],
  support: ["Customer service & success", [
    ["Customer Service Representative", "customer service,customer support,retail,communication"],
    ["Customer Success Specialist", "customer success,onboarding,renewals,customer relationships"],
    ["Technical Support Specialist", "technical support,troubleshooting,help desk,ticketing"],
  ]],
  logistics: ["Supply chain & logistics", [
    ["Logistics Coordinator", "logistics,shipping,transportation,inventory,warehouse"],
    ["Supply Chain Analyst", "supply chain,inventory,forecasting,procurement,analytics"],
    ["Procurement Specialist", "procurement,purchasing,vendors,sourcing"],
    ["Inventory Analyst", "inventory,stock,warehouse,excel,inventory analysis"],
  ]],
  healthcare: ["Healthcare & life sciences", [
    ["Healthcare Administrator", "healthcare administration,healthcare,medical records,scheduling"],
    ["Clinical Research Coordinator", "clinical research,clinical trials,research,documentation"],
    ["Medical Assistant", "medical assistant,patient care,clinical documentation,vitals"],
    ["Health Information Specialist", "health information,medical records,healthcare,data entry"],
  ]],
  education: ["Education & training", [
    ["Instructional Coordinator", "education,curriculum,lesson planning,instructional design"],
    ["Teaching Assistant", "teaching,tutoring,students,classroom,education"],
    ["Academic Advisor", "advising,student support,academic advising,education"],
    ["Training Coordinator", "training,facilitation,learning,professional development"],
  ]],
  legal: ["Legal & compliance", [
    ["Compliance Analyst", "compliance,policy,regulations,risk management,audit"],
    ["Legal Assistant", "legal,legal research,legal documents,documentation"],
    ["Paralegal", "paralegal,legal research,case management,legal writing"],
  ]],
};

export const departmentChoices = Object.entries(departmentRoles).map(([id, [label]]) => ({ id, label }));

export function stateName(value) {
  const term = preferenceWords(value);
  return Object.entries(states).find(([code, name]) => preferenceWords(code) === term || preferenceWords(name) === term)?.[1] || "";
}

const contains = (text, phrase) => (" " + text + " ").includes(" " + preferenceWords(phrase) + " ");

export function rankDepartmentRoles(resume, department) {
  if (!Object.hasOwn(departmentRoles, department)) return [];
  const track = departmentRoles[department];
  const normalized = preferenceWords(resume);
  return track[1].map(([title, terms]) => {
    const keywords = terms.split(",");
    const evidence = keywords.filter(term => contains(normalized, term));
    const score = evidence.length + (contains(normalized, title) ? 4 : 0);
    return { title, keywords, evidence, score };
  }).sort((a, b) => b.score - a.score);
}

export function automaticPreferences(resume, choices, modelTitle) {
  const { work, relocation, department, years } = choices;
  const state = relocation === "stay" ? stateName(choices.state || "") : "";
  if (!workArrangements.includes(work) || !["relocate", "stay"].includes(relocation) ||
      (relocation === "stay" && !state) || !Object.hasOwn(departmentRoles, department) ||
      !Number.isFinite(years) || years < 0 || years > 60) {
    throw new Error("Choose a work arrangement, location preference, department and experience. Enter a valid state if staying.");
  }
  const ranked = rankDepartmentRoles(resume, department);
  const supported = ranked.filter(candidate => candidate.score > 0);
  const candidates = supported.length ? supported : ranked;
  const chosen = candidates.find(candidate => candidate.title === modelTitle) || candidates[0];
  const level = years < 3 ? "Entry level" : years < 6 ? "Mid-level" : "Senior";
  // These broad, editable planning bands are not measured market salaries.
  const higherPay = ["tech", "finance", "business"].includes(department);
  const bands = higherPay
    ? ["$50,000–$95,000", "$75,000–$140,000", "$100,000–$190,000"]
    : ["$35,000–$70,000", "$50,000–$100,000", "$75,000–$140,000"];
  const pay = bands[years < 3 ? 0 : years < 6 ? 1 : 2];
  const departmentLabel = departmentRoles[department][0];
  return {
    role: chosen.title,
    place: state || "Any location",
    work,
    level,
    pay,
    description: chosen.title + " — " + level + ". Role focus: " + chosen.keywords.slice(0, 5).join(", ") + ".",
    department: departmentLabel,
    roles: [chosen.title, ...supported.filter(candidate => candidate.title !== chosen.title).slice(0, 4).map(candidate => candidate.title)],
    evidence: chosen.evidence,
  };
}
