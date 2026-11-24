# AI Career Match

AI Career Match is a web app for students and early-career job seekers. Upload your resume, find current openings, compare your experience with a specific posting, and use that comparison to prepare your application and interview answers. Resume excerpts and job requirements carry through the workflow, so you can see which claims support a score, a draft, or a practice question.

[Open the web app](https://victordamdanh.github.io/Ai-Career-Coach/) · [Browse the web app source](https://github.com/victordamdanh/Ai-Career-Coach/tree/career-match-web-demo/career-match-web) · [Developer documentation](https://github.com/victordamdanh/Ai-Career-Coach/blob/career-match-web-demo/career-match-web/README.md)

## Use the app

Start on the **Resume** page. Use the **Continue** button on each page to move through the workflow. You can revisit earlier steps to revise your inputs.

| Step | What you can do |
| --- | --- |
| 1. Resume | Upload a text-readable PDF, Word DOCX, or TXT file up to 5 MB. Review or edit the extracted text before moving on. |
| 2. Preferences | Choose or type a job title, location, experience level or employment type, and target salary range in USD. Paste a target job description if you already have one. |
| 3. Resume Review | Get a score out of 100 with explanations for organization, clarity, impact, relevance, and skills. **Get AI feedback** adds a strength and a concrete improvement based on your resume. |
| 4. Find Jobs | Browse live openings grouped by employer. Expand **Job details**, open the source posting, or select the opening to carry its description into Job Match. |
| 5. Job Match | Compare your resume with the selected posting or a pasted description. Review the score, supporting excerpts, partial matches, gaps, and suggestions. |
| 6. Application Draft | Prepare an editable cover note from supporting resume evidence. Copy the draft or open the employer’s application. The optional Chrome form helper fills supported fields on matching Greenhouse pages. |
| 7. Interview Inbox | Paste a recruiter message or connect Gmail with read-only access. The app flags possible invitations and links Gmail results to the original threads. |
| 8. Interview Practice | Generate a role-specific question, hear it read aloud, and type or dictate an answer. An optional camera preview lets you rehearse on screen. Feedback covers relevance, specificity, structure, action, and result. |
| 9. Career Chat | Ask the agent to explain a score, find current openings, or suggest your next step. Enable **Include my resume and job details** to use those details in the conversation. |
| 10. Saved Profile and Jobs | Keep candidate details, extracted resume text, and selected job snapshots. GitHub Pages keeps them for the current tab session. A backend deployment can save them across visits. |

The PDF reader extracts text from the first 10 pages and the app accepts up to 14,000 characters of resume text. Run OCR on a scanned PDF first, or export it to a text-readable format.

## How jobs are found and scored

**Find Jobs** checks 19 configured company boards through Greenhouse and also queries the [Jobicy remote jobs feed](https://jobicy.com/). It starts with your title, location, level, and salary preferences and uses relevant resume skills and related titles to rank results. **Search with AI** can suggest additional titles while the initial search runs. **Show more companies** reveals more of the current results.

If there are no openings under the selected filters, the search can widen its location, level, or salary criteria. The results banner identifies any criteria that changed. Openings with unreported or noncomparable pay can appear. The app searches its connected sources, so results depend on the employers covered and each feed’s availability. Confirm current details on the posting before applying.

**Job Match** evaluates the qualifications in one posting. Quick Match uses source-based rules. **Run live AI** compares selected resume and posting excerpts and checks the model’s source references before scoring. If the model cannot produce usable comparisons, the app can show a labeled source-based result.

| Scoring rule | Points |
| --- | ---: |
| Required qualification | 2 available |
| Preferred qualification | 1 available |
| Match, partial evidence, or gap | Full, half, or zero credit |

The match percentage is the earned points divided by the available points, rounded to a whole percent. It estimates how well the resume demonstrates the posting’s qualifications. Employers make their own screening decisions. Resume Review is a separate checklist with five categories worth up to 20 points each.

## Apply and prepare for interviews

Run Job Match before preparing a draft. Review the note for accuracy, then use the employer’s link to open the application. For a supported Greenhouse opening, the optional [form helper](https://github.com/victordamdanh/Ai-Career-Coach/tree/career-match-web-demo/career-match-web/extension) can fill supported fields from a packet you paste. Review the fields, attach your resume, and submit from the employer’s site.

To check a recruiter reply, paste it into **Interview Inbox** or connect a Gmail account. Continue to **Interview Practice** to generate a first-round question based on the selected job and available match details. Use **Read question aloud**, **Answer by voice**, or the text box. The camera is a local preview. Feedback scores the answer transcript out of 100, with a labeled checklist when AI feedback is unavailable or incomplete.

### Connect Gmail

A Gmail connection is optional. Pasted messages work without it.

1. In Google Cloud, enable the Gmail API and create a **Web application** OAuth client for your deployment. For the public app, add `https://victordamdanh.github.io` as an authorized JavaScript origin. For another deployment, use its exact origin, including its port when applicable. The popup flow uses JavaScript origins.
2. Configure the `https://www.googleapis.com/auth/gmail.readonly` scope. If the OAuth app is in **Testing** mode, add the Gmail accounts that will test it.
3. In **Interview Inbox**, expand **Connect Gmail for read-only inbox checks**, enter your OAuth web client ID, and choose **Connect Gmail**. Review the requested access in Google’s window.
4. The app checks up to 20 matching inbox messages from the past 30 days on connection and when you click **Check recent messages**. It looks for possible invitations in the previews. Verify any result in Gmail. Use **Disconnect** to revoke the tab’s access token.

The inbox check runs while the page is open and on demand. It neither sends replies nor monitors email in the background. [Google OAuth token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)

## Browser, AI, and data

| Where you run it | AI and storage |
| --- | --- |
| Public GitHub Pages | Live AI runs in the browser through WebLLM. Resume text, chat history, saved profiles, and saved jobs are held in the current tab session and clear on reload. |
| Local Node.js | Adds persistent SQLite storage for saved profiles and job snapshots. Career Chat can use a server-side Gemini key with a backup model. |
| Hosted Worker | Supports persistent storage with Cloudflare D1 and a trusted sign-in gateway. Gemini is optional and runs through the backend for signed-in users. |

Use current desktop Chrome or Edge with WebGPU for on-device AI. The first use downloads a model, so loading time depends on your device and network. The resume checklist, Quick Match, live job search, and pasted-message invitation check work without the language model. Voice and camera features require browser support and permission.

The resume file is parsed in your browser. If you enable Gemini on a backend, Google processes chat requests and any resume or posting excerpts you choose to include. Gmail checks make read-only requests to Google from the current tab and keep the short-lived token in memory.

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
