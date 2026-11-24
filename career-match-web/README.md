# AI Career Match web demo

This high-code prototype accompanies AI Career Coach. It helps candidates review a resume, find current job postings, prepare an application, and rehearse an interview.

## Public classroom edition

GitHub Pages serves the classroom demo from this branch’s generated `docs/` folder. Run `node scripts/build-pages.mjs` and copy `dist/pages/` to `docs/` to regenerate it. This edition keeps candidate data in memory for the current tab and uses the same scoring and example cases as the backend. Company searches call public job boards from the browser. Career Chat starts loading a smaller browser model when you focus the question field. It streams short replies and can switch to the larger browser model. The first download depends on your network and device. Keep local or separately hosted Node/Worker deployments for persistent profile and job storage.

## Run

Use Node.js 22.13 or later. From this folder run `npm start` and open `http://127.0.0.1:3000`. Use `npm test` to run the automated checks and `npm run build` to produce the Worker bundle at `dist/server/index.js`. The local server keeps resumes, applicant contact information, and saved job snapshots in the ignored SQLite file `career-match.sqlite`. Run the local server only on your own machine. A hosted Worker requires a `DB` D1 binding, the included SQL migration, and a trusted sign-in gateway that inserts the authenticated user ID and strips incoming identity headers. Each account can see or delete only its own records.

Desktop Chrome or Edge with WebGPU is recommended for live inference. The first run downloads Qwen 2.5 1.5B through WebLLM. Resume parsing and model inference happen in the browser. A scanned image-only PDF requires OCR before upload. The file reader extracts up to the first 10 PDF pages, and the prototype analyzes an editable 3,000-character excerpt.

## Career Chat

The local and Worker builds use Gemini 3.5 Flash-Lite with Gemini 3.1 Flash-Lite as the backup for temporary provider errors. Set `GEMINI_API_KEY` in the backend environment before starting the server. The key stays server-side. On a hosted Worker, Gemini is available only to signed-in visitors through the trusted sign-in gateway. If Gemini is unavailable, the chat tries the on-device Qwen model and can switch to a smaller Qwen model if the primary browser model fails.

The chat sends resume and job details only when **Include resume and job details** is checked. Chat history stays in the current tab. Use the sample resume for a classroom demo.

## How it works

- The frontend scans PDF, DOCX, or TXT and collects job preferences. Title, location, and employment level seed the search. Salary preferences are shown for review, since public listings may omit pay.
- The agent extracts requested qualifications and compares them with the resume. It validates source excerpts, retries invalid output once, calls the scoring API, and generates five next steps. Exact-quote validation establishes that the text exists. Review the relevance of each quote and the required/preferred classification.
- Resume quality follows AI Career Coach's five 20-point criteria: organization, clarity, impact, relevance, and skills. Role alignment follows the earlier job-fit rubric: required qualifications are worth two points, preferred are worth one, and partial evidence earns half the available points. These are advisory scores. Hiring outcomes require separate evaluation.
- The backend reads public Greenhouse boards for Cloudflare, Figma, and Databricks and returns official job URLs. The browser prepares an editable cover note from matched evidence. To autofill supported fields, load the `extension/` folder as an unpacked Chrome extension, copy an application packet, open the matching Greenhouse-hosted job page, and paste the packet into the extension. Review the populated fields and attach the resume yourself. The helper runs only on supported Greenhouse domains and never submits a form.
- The inbox can check pasted recruiter messages. A Gmail check requires a Google Cloud web OAuth client, Gmail API enabled, this exact web origin registered, and authorization from the Gmail account. In OAuth testing mode, add the account as a test user. The demo stores the short-lived token in memory and scans recent inbox previews on demand. It shows in-app notices and does not run outside the page or send mail. Recruiter message previews can be incomplete. [Google OAuth token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- Interview practice generates a role-specific question, reads it aloud, and takes a typed or dictated answer. Camera preview is local and optional. Feedback scores the transcript in five criteria for a total out of 100.

## Dataset and evaluation

The real-world dataset consists of selected, paraphrased qualifications from three federal postings. A fictional candidate is used for every case. The sample walkthroughs are reviewed reference examples, and their values serve as expectations for the deterministic score API.

| Case | Source | Reference score | What to inspect |
| --- | --- | ---: | --- |
| Web development | [USAJOBS 855341900](https://www.usajobs.gov/job/855341900) | 83 | React/CSS is grounded, while Flask provides only partial evidence for Node/Express. |
| Data science internship | [USAJOBS 893042500](https://www.usajobs.gov/job/893042500) | 71 | Python and a dashboard are explicit, while documentation and data checks need more detail. |
| Experienced data scientist | [USAJOBS 892168600](https://www.usajobs.gov/job/892168600) | 36 | A degree is visible, but production ML and RAG evidence is missing. |

To evaluate live results, run each posting with the same fictional resume. Record evidence validity, match-status agreement on shared qualifications, required/preferred agreement, false claims, and total time. Compare with a keyword-only pass or manually reviewed labels. Keep live observations separate from the reference scores. Three examples can demonstrate behavior but cannot establish overall accuracy.

## Five-minute presentation

| Time | Show |
| --- | --- |
| 0:00–0:45 | Use the student job-search problem and show the upload and preferences steps. |
| 0:45–2:10 | Open Job match, then use the web-development walkthrough or run live AI. Expand the Flask versus Node/Express evidence and calculate the partial credit. |
| 2:10–3:00 | Explain agent stages, bounded retry, structured output, deterministic scoring, and which data the backend stores. |
| 3:00–4:10 | Open a sourced job posting, show the reviewed draft, load the sample recruiter email, and demonstrate one practice question. |
| 4:10–5:00 | Review the three cases, what was verified, and limits such as model latency, small sample size, permissions, and the handoff to employers. |

The practical benefit is traceability across a multi-step workflow. The main trade-offs are model quality, browser compatibility, network availability, and limited public access to employer application forms. The prototype can point to evidence and improve application preparation, while the employer controls screening and submission.
