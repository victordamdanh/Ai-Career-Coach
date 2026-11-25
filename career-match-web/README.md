# AI Career Match developer documentation

AI Career Match brings resume review, live job discovery, evidence-based matching, application drafting, interview support, and career chat into one web workflow.

[Open the web app](https://victordamdanh.github.io/Ai-Career-Coach/) · [Feature and user guide](../README.md#use-the-app) · [Gmail setup](../README.md#connect-gmail)

## Guided applications and shared interview practice

Upload a resume and choose **Set preferences myself** or **Start with AI**. Start with AI opens a four-choice setup dialog: work arrangement, relocation/current state, department, and years of experience. It ranks department-specific roles using the uploaded resume, optionally asks the fast language model to choose a supported title, and fills the job title, location, work arrangement, level, editable salary planning band, and role focus. It automatically generates all five resume scores and model feedback (or labeled checklist feedback), searches live postings with strict guided filters, and compares up to four ranked openings in one run. It uses a source-based comparison for the automatic shortlist and opens the highest-scoring draft. If the match has no aligned evidence or scoring is unavailable, it still prepares an editable, clearly labeled cover note from genuine resume text without inventing qualifications. Drafts are cached per selected posting and resume for the current tab; user edits survive navigation, comparison retries and late AI excerpt selection. Applicant contact fields are extracted when readable and remain editable. An unresolved name placeholder blocks sending an application email. View all drafts in Find Jobs, or use Job Match for a detailed live AI comparison. Guided searches keep the selected filters; a no-result search returns to Find Jobs for the user to revise them. The work arrangement is identified from posting metadata and explicit location/title or description signals; unknown arrangements are not treated as confirmed matches. The listing lookup also uses separate posting-location and office fields, recognizes explicitly offered hybrid and nationwide remote alternatives, and labels unreported experience levels rather than assuming a mismatch. It first checks compact company-board summaries and loads descriptions for relevant boards, retaining verified summary matches if details are unavailable. A remote role must indicate the chosen state or nationwide U.S. eligibility for state-restricted guided searches. Continuing to Find Jobs during the automatic search preserves the in-flight task. The application can be sent by Gmail when the posting accepts email applications and the user confirms the recipient and attachment. For employer web forms, use the employer link or the optional Greenhouse form helper and mark the application submitted after completing it.

Interview Inbox can check Gmail every two minutes while the tab is open. To apply company labels to linked recruiter conversations, choose the labeling option and grant Gmail modify access. Read-only inbox access remains available. The send flow asks for a separate send authorization. Configure the corresponding Gmail scopes on the OAuth app before testing those features. The browser keeps the watch list and OAuth tokens in memory.

Both start paths use the same Interview Practice page. **Start interview** opens a video-call room with Maya’s photorealistic, AI-generated portrait centered and the user’s camera preview in the corner. Maya uses separate WebP room, body and head layers, nine mouth frames and four eyelid frames. Word boundaries from speech synthesis guide the mouth's word-sized openings, stressed-vowel shapes and pauses; gaze, blinks and posture vary with whether she is speaking or listening. Animation stops when the room is paused or closed. Question and feedback context comes from the selected Job Match, recorded application, and any linked interview invitation, including the company, job title, experience level, and job requirements. The interview room shows the original job link and refreshes the selected listing through its source API while keeping the saved job context available if it is no longer listed. The five lightweight WebP assets are copied into Pages and served directly by the combined Worker. The app speaks the question, listens to spoken answers, acknowledges a completed answer, and moves to the next question after a pause. **Pause** releases microphone and camera access, **Resume** restores the call, and **End interview** analyzes completed voice answers automatically. Up to three answers are reviewed and scored using the language model or the transcript checklist when on-device AI is unavailable. A linked interview notice can open the practice page with that posting’s context. Use a browser that supports microphone speech recognition and text-to-speech; recognition may use the browser’s speech service.

## Saved resume and interview history

Use **My saved records** from the header, even before uploading a resume. Sign in to the dedicated [AI Career Match Supabase project](https://supabase.com/dashboard/project/vzvzvprrnisijflaynve) with an email/password account. Create an account if available and confirm the email address if required. The default Supabase email service is limited; if confirmation is not delivered, the project owner must provision a confirmed test account or configure email delivery. No email service subscription is configured by the application.

- Save the current extracted resume under a user-chosen name; load the text again or delete individual versions. Re-upload the original PDF/DOCX when you need an application attachment.
- After a completed spoken interview, click **Name and save interview**. The unsaved feedback includes the role, company, level, resume name, job URL, transcript, score, and recommendations. Give the record a name and save it, or discard it. No audio or video is retained.
- Sign in again after reload to access your cloud history on another device. Only the records you explicitly save leave the tab for Supabase storage. The browser keeps the access token in memory. Delete individual records or all saved data from the profile.
- [Schema](supabase/schema.sql) defines account-owned profile, job, and history tables, including RLS; [history migration](supabase/history_migration.sql) upgrades an existing installation. The frontend configuration contains only the project URL and publishable key, not a privileged key.

## Start the local app

Use Node.js **22.13 or later**. Run the commands from this directory.

```bash
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Run `npm test` in a separate terminal to run the automated checks. The server binds to loopback and uses `career-match.sqlite` by default. Set `PORT` or `DATABASE_PATH` in the environment to change the port or database path. The database holds saved candidate contact fields and extracted resume text, plus named resume versions, interview transcripts and feedback, and job snapshots with the title, company, location, source URL, and posting excerpt.

Set `GEMINI_API_KEY` in the server environment to enable Gemini for Career Chat. The backend tries Gemini 3.5 Flash-Lite first and Gemini 3.1 Flash-Lite on eligible failures. Chat falls back to on-device Qwen if the backend is unavailable. Keep the API key in server configuration. The public build uses on-device chat.

## Source layout

| Path | Role |
| --- | --- |
| [`web/`](web/) | Browser UI, workflow state, resume parsing and review, WebLLM, evidence checking, interview and inbox controls, and Career Chat tools. |
| [`src/listings.mjs`](src/listings.mjs) and [`src/api.mjs`](src/api.mjs) | Live company boards, remote feed, listing lookup, filtering, reference cases, and deterministic match scoring. |
| [`src/account.mjs`](src/account.mjs) and [`drizzle/`](drizzle/) | Profile, saved-job and history endpoints with the shared SQLite and D1 schema. |
| [`supabase/`](supabase/) and [`python-backend/`](python-backend/) | Dedicated PostgreSQL schema and separate FastAPI backend. |
| [`src/chat.mjs`](src/chat.mjs) | Server-side Gemini requests, input limits, and model fallback. |
| [`hosting/pages/request.mjs`](hosting/pages/request.mjs) | In-browser request adapter and Supabase authentication and private persistent records for GitHub Pages. |
| [`extension/`](extension/) | Optional Chrome extension that fills supported application fields from an explicitly pasted packet. |
| [`test/`](test/) | Regression checks for workflow, resume processing, job search and preferences, scoring, chat tools, drafting, and practice. |

## Workflow and tool design

- [Workflow state](web/workflow.mjs) defines the ten pages. The UI tracks progress and Career Chat can use that progress to recommend the next step.
- [The comparison agent](web/agent.mjs) sends selected resume and posting excerpts with source IDs to the on-device model. It validates returned IDs and retries once if the model produces no usable rows. The [scoring tool](src/api.mjs) computes the weighted score from the checked rows. A source-based fallback can still compare related wording.
- [Career Chat tools](web/chat-agent.mjs) can read the resume checklist, search live postings, and explain a current match report. Live-job replies can show tool-supplied links directly. The opt-in context includes resume and posting excerpts when the user selects **Include my resume and job details**.
- [WebLLM](web/agent.mjs) uses Qwen 2.5 0.5B for fast tasks such as chat and Qwen 2.5 1.5B for deeper comparisons, with a model fallback. First-use download time and browser WebGPU support affect live inference.
- [Interview Inbox](web/inbox.mjs) checks invitation cues with a rule-based detector. Gmail requests use Google Identity Services with read-only access by default, optional modify access to label linked application threads, and separate send authorization for reviewed application emails. The user can enable checks every two minutes while the tab remains open. Invitation detection classifies message previews; matches are tentative and link to the original thread and any associated job.

## Build and deploy

### GitHub Pages

Run the following from `career-match-web/` to rebuild the public assets for the `career-match-web-demo` branch.

```bash
node scripts/build-pages.mjs
cp -R dist/pages/. ../docs/
```

The branch’s `docs/` folder serves the [public site](https://victordamdanh.github.io/Ai-Career-Coach/). The static edition runs matching and listing code in the browser and saves explicitly selected records to the dedicated AI Career Match Supabase project. Account data is protected by owner-only RLS.

### Worker with persistent storage

Run `npm run build` to generate `dist/server/index.js`. Apply [the initial SQL migration](drizzle/0000_career_match.sql) and [the history migration](drizzle/0001_history.sql) to a Cloudflare D1 database and attach it through a `DB` binding. Put the Worker behind a trusted sign-in gateway that strips any client-supplied `oai-authenticated-user-id` header and supplies the verified account ID itself. Account operations use that ID to scope saved data. Add `GEMINI_API_KEY` as a Worker secret if you enable Gemini chat.

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
