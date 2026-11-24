export const resume = `Jordan Lee | Demonstration resume
B.S. in Computer Science.
Front-end engineering internship: built responsive dashboards with React and CSS. Used Git for code reviews and collaborated with design and product.
Project: wrote SQL queries in PostgreSQL and built a dashboard for a campus retail dataset. Cleaned duplicate and missing records with Python.
Course project: built and documented a Flask REST API.`;

export const jobs = [
  {
    id: "web", title: "Full-stack web development", source: "USAJOBS · 855341900",
    url: "https://www.usajobs.gov/job/855341900",
    note: "Uses selected duties from the posting. Check the original announcement for full qualifications and eligibility.",
    requirements: [
      ["skills", "Build responsive web apps using React and CSS.", "match", "built responsive dashboards with React and CSS"],
      ["skills", "Develop REST APIs using Node.js and Express.", "partial", "built and documented a Flask REST API"],
      ["skills", "Use version control with Git or Bitbucket.", "match", "Used Git for code reviews"],
      ["experience", "Work with teams across disciplines to deliver features.", "match", "collaborated with design and product"],
      ["projects", "Build solutions that combine a web application and PostgreSQL.", "partial", "wrote SQL queries in PostgreSQL and built a dashboard"],
    ],
    actions: [
      "Lead with your React and CSS dashboard internship bullet.",
      "Add a concrete outcome from your collaboration with design and product, if available.",
      "Build a small REST endpoint in Node.js and Express to demonstrate the requested stack.",
      "Connect a React project to PostgreSQL through that API and document the workflow.",
      "Include a portfolio link with a README and an example of your Git workflow.",
    ],
  },
  {
    id: "intern", title: "Data science internship", source: "USAJOBS · 893042500",
    url: "https://www.usajobs.gov/job/893042500",
    note: "The posting offers multiple education and experience pathways and includes separate student eligibility conditions. This sample compares selected duties only.",
    requirements: [
      ["skills", "Prepare data using Python, R, SQL, or spreadsheets.", "match", "Cleaned duplicate and missing records with Python"],
      ["skills", "Check for missing values, duplicates, and inconsistent formats.", "partial", "Cleaned duplicate and missing records with Python"],
      ["experience", "Document analytical workflows and communicate findings and limitations.", "partial", "built and documented a Flask REST API"],
      ["projects", "Produce routine charts or dashboards from data.", "match", "built a dashboard for a campus retail dataset"],
    ],
    actions: [
      "Move the Python cleanup bullet near the top of the resume.",
      "Describe how you checked inconsistent formats if you performed that check.",
      "Add a short write-up explaining the dashboard findings and data limitations.",
      "Include a reproducible notebook or SQL file alongside your dashboard.",
      "Check the complete announcement for eligible graduation dates and qualification pathways.",
    ],
  },
  {
    id: "senior", title: "Experienced data scientist", source: "USAJOBS · 892168600",
    url: "https://www.usajobs.gov/job/892168600",
    note: "Compares selected duties and degree criteria. Check the original announcement for grade-specific experience, alternative qualifications, and eligibility.",
    requirements: [
      ["skills", "Use PySpark, Spark SQL, and Delta Lake for data workflows.", "partial", "wrote SQL queries in PostgreSQL"],
      ["skills", "Design retrieval-augmented generation (RAG) pipelines.", "gap", ""],
      ["experience", "Deploy and manage production machine learning projects independently.", "gap", ""],
      ["education", "Hold a bachelor's degree or higher in computer science or a related field.", "match", "B.S. in Computer Science."],
      ["projects", "Build and deploy agents for conversational data analysis.", "gap", ""],
    ],
    actions: [
      "Keep the computer science degree visible.",
      "Build a small PySpark and Delta Lake pipeline to complement your SQL experience.",
      "Create a retrieval-augmented generation prototype and document how you evaluated it.",
      "Practice deploying and monitoring a small ML project before claiming production experience.",
      "Compare your experience with the full posting for the specific grade before applying.",
    ],
  },
];

export function description(job) {
  return job.requirements.map(([, text]) => text).join("\n");
}

export function walkthrough(job) {
  return {
    mode: "walkthrough",
    rows: job.requirements.map(([category, requirement, status, evidence]) => ({
      category, requirement, jobQuote: requirement, status, evidence,
      priority: category === "projects" || (job.id === "senior" && category === "skills") ? "preferred" : "required",
    })),
    actions: job.actions,
  };
}
