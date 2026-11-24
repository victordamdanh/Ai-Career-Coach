# AI Career Match developer documentation

AI Career Match brings resume review, live job discovery, evidence-based matching, application drafting, interview support, and career chat into one web workflow.

[Open the web app](https://victordamdanh.github.io/Ai-Career-Coach/) · [Feature and user guide](../README.md#use-the-app) · [Gmail setup](../README.md#connect-gmail)

## Guided applications and shared interview practice

Upload a resume and choose **Set preferences myself** or **Start with AI**. Start with AI reads the uploaded resume, uses any set preferences, scores the resume, searches live sources, and compares up to four ranked openings in one run. It uses a source-based comparison for the automatic shortlist and opens the highest-scoring draft. View all drafts in Find Jobs, or use Job Match for a detailed live AI comparison. The workflow pauses for a job title when it cannot infer one and asks the user to review results when search filters have been widened. The application can be sent by Gmail when the posting accepts email applications and the user confirms the recipient and attachment. For employer web forms, use the employer link or the optional Greenhouse form helper and mark the application submitted after completing it.

Interview Inbox can check Gmail every two minutes while the tab is open. To apply company labels to linked recruiter conversations, choose the labeling option and grant Gmail modify access. Read-only inbox access remains available. The send flow asks for a separate send authorization. Configure the corresponding Gmail scopes on the OAuth app before testing those features. The browser keeps the watch list and OAuth tokens in memory.

Both start paths use the same Interview Practice page. Maya, the illustrated interviewer, reads questions aloud. Answer by voice or text and choose **Pause** to step away or **End interview** to finish early. After up to three answers, the app scores the transcript and gives suggestions. A linked interview notice can open the practice page with that posting’s context.

## Start the local app

Use Node.js **22.13 or later**. Run the commands from this directory.

```bash
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Run `npm test` in a separate terminal to run the automated checks. The server binds to loopback and uses `career-match.sqlite` by default. Set `PORT` or `DATABASE_PATH` in the environment to change the port or database path. The database holds saved candidate contact fields and extracted resume text, plus job snapshots with the title, company, location, source URL, and posting excerpt.

Set `GEMINI_API_KEY` in the server environment to enable Gemini for Career Chat. The backend tries Gemini 3.5 Flash-Lite first and Gemini 3.1 Flash-Lite on eligible failures. Chat falls back to on-device Qwen if the backend is unavailable. Keep the API key in server configuration. The public build uses on-device chat.

## Source layout

| Path | Role |
| --- | --- |
| [`web/`](web/) | Browser UI, workflow state, resume parsing and review, WebLLM, evidence checking, interview and inbox controls, and Career Chat tools. |
| [`src/listings.mjs`](src/listings.mjs) and [`src/api.mjs`](src/api.mjs) | Live company boards, remote feed, listing lookup, filtering, reference cases, and deterministic match scoring. |
| [`src/account.mjs`](src/account.mjs) and [`drizzle/`](drizzle/) | Profile and saved-job endpoints with the shared SQLite and D1 schema. |
| [`src/chat.mjs`](src/chat.mjs) | Server-side Gemini requests, input limits, and model fallback. |
| [`hosting/pages/request.mjs`](hosting/pages/request.mjs) | In-browser request adapter and in-memory profiles and jobs for GitHub Pages. |
| [`extension/`](extension/) | Optional Chrome extension that fills supported application fields from an explicitly pasted packet. |
| [`test/`](test/) | Regression checks for workflow, resume processing, job search and preferences, scoring, chat tools, drafting, and practice. |

## Workflow and tool design

- [Workflow state](web/workflow.mjs) defines the ten pages. The UI tracks progress and Career Chat can use that progress to recommend the next step.
- [The comparison agent](web/agent.mjs) sends selected resume and posting excerpts with source IDs to the on-device model. It validates returned IDs and retries once if the model produces no usable rows. The [scoring tool](src/api.mjs) computes the weighted score from the checked rows. A source-based fallback can still compare related wording.
- [Career Chat tools](web/chat-agent.mjs) can read the resume checklist, search live postings, and explain a current match report. Live-job replies can show tool-supplied links directly. The opt-in context includes resume and posting excerpts when the user selects **Include my resume and job details**.
- [WebLLM](web/agent.mjs) uses Qwen 2.5 0.5B for fast tasks such as chat and Qwen 2.5 1.5B for deeper comparisons, with a model fallback. First-use download time and browser WebGPU support affect live inference.
- [Interview Inbox](web/inbox.mjs) checks invitation cues with a rule-based detector. Gmail requests use Google Identity Services and the read-only Gmail scope. Only previews are classified. Detected invitations are tentative and open the original threads for review.

## Build and deploy

### GitHub Pages

Run the following from `career-match-web/` to rebuild the public assets for the `career-match-web-demo` branch.

```bash
node scripts/build-pages.mjs
cp -R dist/pages/. ../docs/
```

The branch’s `docs/` folder serves the [public site](https://victordamdanh.github.io/Ai-Career-Coach/). The static edition runs matching and listing code in the browser and keeps profiles and saved jobs in memory for the page session.

### Worker with persistent storage

Run `npm run build` to generate `dist/server/index.js`. Apply [the SQL migration](drizzle/0000_career_match.sql) to a Cloudflare D1 database and attach it through a `DB` binding. Put the Worker behind a trusted sign-in gateway that strips any client-supplied `oai-authenticated-user-id` header and supplies the verified account ID itself. Account operations use that ID to scope saved data. Add `GEMINI_API_KEY` as a Worker secret if you enable Gemini chat.

### Optional Greenhouse form helper

Open `chrome://extensions`, enable **Developer mode**, and load this directory’s `extension/` folder as an unpacked extension. Copy the form helper packet from Application Draft, open the matching Greenhouse job form, and paste the packet into the extension. Verify the populated fields, attach the resume, and submit on the employer’s page.

## Data sources and evaluation

Live job discovery queries the configured [Greenhouse company boards](src/listings.mjs) and [Jobicy](https://jobicy.com/). The title picker uses the U.S. Department of Labor’s [O*NET 31.0 Database](https://www.onetcenter.org/database.html) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The location picker draws from the [2025 Census Gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html). The catalog trims and deduplicates titles, adds common roles, and removes common legal designation suffixes from place names.

To regenerate the suggestions, run `python3 scripts/build-preference-catalog.py /path/to/sample_of_reported_titles.csv /path/to/2025_Gaz_place_national.zip`.

The [reference fixtures](src/data.mjs) use selected qualifications paraphrased from three real federal postings and one fictional resume. These scores are deterministic expectations used to check scoring behavior.

| Case | Posting source | Reference score |
| --- | --- | ---: |
| Full-stack web development | [USAJOBS 855341900](https://www.usajobs.gov/job/855341900) | 83 |
| Data science internship | [USAJOBS 893042500](https://www.usajobs.gov/job/893042500) | 71 |
| Experienced data scientist | [USAJOBS 892168600](https://www.usajobs.gov/job/892168600) | 36 |

To evaluate live comparisons, run each posting against the same resume and record evidence validity, agreement with reviewed match and priority labels, unsupported claims, and elapsed time. Compare against Quick Match or a manual review. Three reference cases show how the scoring behaves on specific examples. Estimating accuracy across roles requires a larger set of reviewed examples.
