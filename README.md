# AI Career Match

AI Career Match is an AI-assisted web application for job seekers. It connects resume analysis, current job discovery, qualification matching, application preparation, recruiter email, interview practice, and career coaching in a single workflow. Resume evidence, preferences, selected postings, and application context carry forward between pages so that the recommendations stay relevant to the job.

[Open the public web app](https://victordamdanh.github.io/Ai-Career-Coach/) · [Browse the web app source](https://github.com/victordamdanh/Ai-Career-Coach/tree/career-match-web-demo/career-match-web) · [Developer documentation](https://github.com/victordamdanh/Ai-Career-Coach/blob/career-match-web-demo/career-match-web/README.md)

## Choose your workflow

Upload your own resume to start. The first page has two options.

- **Set preferences myself** — choose your job preferences and use Continue to move through each step. You can revisit earlier pages whenever you need to revise your inputs.
- **Start with AI** — a short setup window asks for remote, hybrid or in-person work; willingness to relocate or your current state; department; and years of relevant experience. The agent combines those choices with resume evidence to choose a job title and related roles in your department, fill the location, work arrangement, level, role focus and an editable salary target, then automatically computes all five resume scores and requests AI feedback. It searches connected live sources without widening the selected filters and prepares up to four application drafts using source-based qualification scores. If no suitable openings are found, edit your preferences or try again. The salary target is a planning suggestion, not measured market pay; if the model is unavailable, evidence-based suggestions and labeled checklist feedback remain available.

Both paths use the same application, inbox, interview, chat and saved-profile features. The guided agent prepares applications; you still review and authorize an email send or submit the employer's form yourself.

## Features

| Step | What you can do |
| --- | --- |
| 1. Resume | Upload a text-readable PDF, Word DOCX, or TXT file up to 5 MB. Review or edit the extracted text before moving on. |
| 2. Preferences | Choose from searchable suggestions or type your own job title, location, work arrangement, experience level or employment type, and target salary range in USD. Paste a target job description if you have one. |
| 3. Resume Review | Get a score out of 100 for organization, clarity, impact, relevance, and skills. See strengths and gaps, and request additional AI feedback based on your resume. |
| 4. Find Jobs | Browse live openings grouped by employer, ranked using your preferences and relevant skills. Expand Job details, view original postings, show more companies, and select a job. |
| 5. Job Match | Compare your resume with the selected posting or a pasted description. Review qualification alignment, supporting excerpts, partial matches, gaps, and improvement suggestions. |
| 6. Application Draft | Prepare editable, evidence-based cover notes immediately. Review applicant contact details extracted from your resume. Guided mode can prepare several drafts and retains edits for each selected posting during the tab session. Open the original application, use the optional Greenhouse form helper, or send a reviewed application and resume to an authorized recruiter address through Gmail. Track submitted applications. |
| 7. Interview Inbox | Paste a recruiter message or connect Gmail. Check for possible interview invitations, optionally organize submitted-application conversations by company, and open practice with the linked job context. |
| 8. Interview Practice | Meet Maya, an AI interviewer, in a simulated video call. Hear questions, answer aloud, and proceed automatically through up to three questions. Pause, resume, or end the call and receive scored transcript feedback. |
| 9. Career Chat | Ask the career agent to explain results, find current openings, or recommend next steps. Enable Include my resume and job details to use that context. |
| 10. Saved Profile and Jobs | Keep candidate details, extracted resume text, and selected job snapshots. Persistent storage is available with a backend; the public Pages edition keeps them for the current tab session. |

The PDF reader extracts text from the first 10 pages and the app accepts up to 14,000 characters of resume text. Run OCR on a scanned PDF first, or export it to a text-readable format.

## How jobs are found and scored

**Find Jobs** checks 19 configured company boards through Greenhouse and also queries the [Jobicy remote jobs feed](https://jobicy.com/). It starts with your title, location, level, and salary preferences and uses relevant resume skills and related titles to rank results. **Search with AI** can suggest additional titles while the initial search runs. **Show more companies** reveals more of the current results.

Manual searches without a selected work arrangement can widen location, level, or salary criteria when no openings match. Guided AI searches keep the location, work arrangement, department roles, level and salary filters; they do not automatically broaden them. Roles with unknown work arrangement are excluded when an arrangement is selected. The search uses the published location, posting metadata, and advertised offices to identify the state; it also recognizes postings that explicitly offer hybrid and nationwide remote options. Remote postings must indicate the selected state or nationwide U.S. eligibility when the user chooses to stay. Jobs with unreported experience level can appear with a verification label, but explicitly incompatible levels are excluded. The results banner identifies any criteria that changed. Openings with unreported or noncomparable pay can appear. The app searches its connected sources, so results depend on the employers covered and each feed’s availability. Confirm current details on the posting before applying.

**Job Match** evaluates the qualifications in one posting. Quick Match uses source-based rules. **Run live AI** compares selected resume and posting excerpts and checks the model’s source references before scoring. If the model cannot produce usable comparisons, the app can show a labeled source-based result.

| Scoring rule | Points |
| --- | ---: |
| Required qualification | 2 available |
| Preferred qualification | 1 available |
| Match, partial evidence, or gap | Full, half, or zero credit |

The match percentage is the earned points divided by the available points, rounded to a whole percent. It estimates how well the resume demonstrates the posting’s qualifications. Employers make their own screening decisions. Resume Review is a separate checklist with five categories worth up to 20 points each.

## Applications and recruiter email

Application Draft uses the selected posting and actual resume. It opens an editable draft immediately, using checked match excerpts when available; otherwise it uses real resume details and labels the alignment as unverified. Even if scoring or the optional language model is unavailable, the draft remains editable. Edits are kept for the same posting and resume during the tab session, and are not overwritten by rerunning Job Match or by late model output. Review the extracted name, email, phone, draft and original resume for accuracy before applying. For a supported Greenhouse opening, the optional [form helper](https://github.com/victordamdanh/Ai-Career-Coach/tree/career-match-web-demo/career-match-web/extension) fills supported fields from an explicitly pasted packet. Review those fields, attach your resume, and submit on the employer's site. Choose **Mark as submitted** to track that application.

If a job accepts applications by email, expand **Send to a recruiter with Gmail**, enter the verified recruiter address, review the note and resume attachment, and authorize the send. The application is tracked after a confirmed send. The app does not invent recruiter addresses, bypass employer forms, or submit applications without the user's review and authorization.

### Connect Gmail

A Gmail connection is optional; pasted messages work without it.

1. In Google Cloud, enable the Gmail API and create a **Web application** OAuth client for your deployment. For the public site, add `https://victordamdanh.github.io` as an authorized JavaScript origin. For another deployment, use its exact origin, including the port when applicable.
2. Configure the scopes needed by the features you want: `https://www.googleapis.com/auth/gmail.readonly` for inbox checks, `https://www.googleapis.com/auth/gmail.modify` for optional company labels, and `https://www.googleapis.com/auth/gmail.send` for sending reviewed applications. If the OAuth app is in Testing mode, add the Gmail test accounts.
3. In **Interview Inbox**, expand **Connect Gmail for inbox checks**, enter the OAuth web client ID, and review the requested permission. Select the company-label option only if you want the app to organize linked conversations under `Job Applications/<company>`.
4. The app checks up to 20 matching inbox messages from the past 30 days on connection and when you select **Check recent messages**. Enable the two-minute check option to refresh while the tab is open. Possible invitations link to the original Gmail thread and, when associated with a tracked job, its interview practice.
5. Choose **Disconnect** to revoke the inbox access token. Sending an application requests separate send permission.

The app keeps Gmail tokens and its application watch list in memory. Invitation detection is a tentative, rule-based classification of message previews. Review the actual email. Monitoring does not continue after the tab is closed or reloaded. [Google OAuth token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)

## Voice interview with Maya

Interview Practice is shared by both start paths. Choose **Start interview** to open a video-call room with Maya's photorealistic AI-generated portrait centered and your own camera preview in the corner.

1. The interview uses the selected Job Match, tracked application, or linked invitation's company, title, seniority, and qualifications. It displays the job link and attempts to refresh the posting through its source API; a saved snapshot remains available if the listing can no longer be refreshed.
2. Maya asks questions aloud. Maya is rendered from lightweight WebP layers: a stationary room, independently moving head and body, and mouth and eyelid frames. Her lips follow browser speech word timing when available, with relaxed transitions between words, natural pauses, slower blinks, and subtle gaze, head and shoulder movement. The room uses browser speech recognition to hear your answer and moves to the next question after a completed response.
3. Use **Pause** when you need a break. The app releases camera and microphone access. **Resume** returns you to the call; **End interview** stops it and generates feedback for completed responses. The session also ends automatically after up to three questions.
4. Review a score out of 100 across relevance, specificity, structure, action, and result, with concrete strengths and improvements. An explicitly labeled transcript checklist is available if model feedback is unavailable.

The camera is a local self-view. Maya is an animated portrait rather than a live video feed, and interview feedback evaluates the spoken transcript, not facial expressions. Speech recognition may use your browser's speech service. Allow microphone permissions and use a browser with compatible speech recognition and synthesis.

## Browser, AI, and data

| Where you run it | AI and storage |
| --- | --- |
| Public GitHub Pages | WebLLM runs live matching, interview feedback and Career Chat on the device. Extracted text, chat history, saved profiles and job snapshots last for the current page session. |
| Local Node.js | Adds persistent SQLite storage for candidates and job snapshots. Career Chat can use a server-side Gemini API key with a backup model and on-device fallback. |
| Hosted Worker | Supports persistent storage with Cloudflare D1 and a trusted sign-in gateway. Gemini is optional and runs through the backend for signed-in users. |

Use current desktop Chrome or Edge with WebGPU for on-device AI. The first use downloads a model, so loading time depends on the device and network. The resume checklist, Quick Match, live job discovery, automatic source-based shortlist and pasted-message invitation check work without the language model. Interview speech, camera and Gmail functions depend on browser support and the relevant permissions.

Resume files are parsed in your browser. If Gemini is enabled on a backend, Google processes chat requests and any resume or posting excerpts you choose to include. Keep model keys in the server environment. Never put a secret key in the frontend. Gmail requests use the permission you grant for that operation.

## Run locally

Use Node.js **22.13 or later**.

```bash
git clone --branch career-match-web-demo https://github.com/victordamdanh/Ai-Career-Coach.git
cd Ai-Career-Coach/career-match-web
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Set `GEMINI_API_KEY` in the server environment if you want Gemini for Career Chat. `npm test` runs the automated checks. The [developer documentation](https://github.com/victordamdanh/Ai-Career-Coach/blob/career-match-web-demo/career-match-web/README.md) covers the source layout, deployment builds, and reference cases.

## Earlier Streamlit edition

The original Python and Streamlit coach is available in [`app.py`](https://github.com/victordamdanh/Ai-Career-Coach/blob/main/app.py). It has its own [hosted app](https://ai-career-coach-8jnrwtqi7drqqdrgai2f2d.streamlit.app/) and uses `requirements.txt` and `GEMINI_API_KEY` when run locally.
