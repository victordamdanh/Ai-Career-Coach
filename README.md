# AI Career Coach classroom guide

A student deciding whether to apply for an internship can use Job Match Analyzer to answer two questions. Which requirements can I already demonstrate? What should I work on next? Use one fictional student and one posting throughout the five-minute presentation so the audience can check the coach's reasoning.

## Prepare before class

1. Open the [hosted coach](https://ai-career-coach-8jnrwtqi7drqqdrgai2f2d.streamlit.app/) and enter the classroom access code. Allow time for the server to wake up.
2. Download Jordan-resume.pdf from the demo folder. Open analyst-intern.txt and copy the entire posting. The posting goes in a text field. The PDF goes in the resume uploader.
3. On Welcome, click Get started to open Upload Resume. Upload Jordan's resume and look for **Resume ready**. Enter **Campus Operations Data Analyst Intern** as the desired job title, **Higher education** as the sector, and **Build a dashboard portfolio project before internship applications** as the goal. Paste the posting under **Target job description**.
4. Check the consent box to send the fictional inputs for AI processing. Click **Continue to Resume Analyzer**, then use **Next step** to reach **Job Match Analyzer** and click **Compare resume with this job**. Open the extracted text, check the results against the original PDF, and download the report. Keep this actual rehearsal report available in case the network stalls during class.

## Five-minute presentation

| Time | What to show | What to say or ask |
| --- | --- | --- |
| 0:00–0:35 | Jordan's resume beside the internship posting | “Jordan has class projects but little work experience. Can a dining survey project count as evidence for this analyst internship?” |
| 0:35–1:20 | Upload the PDF, show the target posting and submit the comparison | Point to the posting's Excel requirement. Ask the audience what evidence they would accept. Explain that students can replace both inputs with their own materials. |
| 1:20–2:30 | Open the extracted resume and the evidence comparison | Find Jordan's 480 survey responses and pivot tables. Compare that wording with the model's assessment. Then find the preferred Power BI requirement. Jordan's charts demonstrate presentation experience, but the resume gives no evidence of an interactive Power BI dashboard. Discuss the actual output if it differs. |
| 2:30–3:35 | Expand Retrieved guidance for comparison | The app ranks local career guidance by term relevance using TF-IDF and cosine similarity. It sends selected passages alongside student inputs to the model. The posting supplies the requirements, the resume supplies evidence, and the retrieved guidance helps interpret it. Point to a source actually displayed. |
| 3:35–4:25 | Show the estimated compatibility score and one next action | Required criteria count twice as much as preferred ones. A match earns full credit, partial evidence earns half. The model classifies evidence and Python calculates the percentage. Suggest that Jordan build a dashboard with location and time filters, test it, then add the project to the resume. |
| 4:25–5:00 | Download the report and return to the student question | “Jordan can already explain the SQL and Excel work. The next portfolio project should give an employer something concrete to inspect.” Mention that the student can practice explaining the project in Interview Coach. |

## Try a contrasting student or a follow-up

Upload Riley-resume.pdf and keep the same posting. Riley briefed volunteers and maintained a spreadsheet, while Jordan explicitly used SQL joins and pivot tables. Inspect how the explanation changes. A missing detail means the document provides insufficient evidence. Check with the student before suggesting any rewrite.

For a follow-up, open **Ask Your Career Coach** with Jordan's inputs and ask “Using only my campus dining project, draft one bullet for this internship and explain which requirement it supports.” Check every number and tool against the original document. In **Career Roadmap**, click **Build my 90-day career plan** and look for a project deliverable at each phase. In **Resume Analyzer**, inspect the five criteria and one suggested rewrite. In **Interview Coach**, select the job-description option and generate five questions. Answer one with a specific example and review the feedback before continuing.

## Explain the implementation

The comparison workflow reads the file, extracts target requirements, and asks the model to classify resume evidence for each one. Career Roadmap adds a planning stage. These are coordinated functions with a fixed sequence. Structured responses and validation make the results easier to inspect. The knowledge library is curated locally. The app does not need a separate database for the demo. Reports stay in the session unless the student downloads them. AI requests send submitted information to Google Gemini.

If asked about AI-assisted coding, show a specific change your group reviewed, such as the sample download or the score calculation. Describe the input you tried, what you observed, and what you would improve. Only claim tests your group actually performed.

## Run or publish the update

Unzip the app package. From the folder containing app.py, install requirements with `python -m pip install -r requirements.txt` and start it with `python -m streamlit run app.py`. Configure GEMINI_API_KEY and the optional DEMO_ACCESS_CODE using Streamlit secrets or environment variables. Keep credentials out of the repository.

For the existing hosted app, put app.py, requirements.txt, demo, and .streamlit/config.toml in the repository root on the branch connected to Streamlit. Preserve the existing Cloud secrets. After redeployment, open the classroom URL in a fresh window and verify that Welcome offers **Download sample resume**. Then run one real comparison. If extraction fails, use the supplied text-readable PDF. If the API key or usage limit blocks analysis, show the saved rehearsal report and identify it as a previous run.

## Move through the coach

Welcome explains the app and each tool. Get started opens Upload Resume, which contains the resume upload, career details, target job description, and consent checkbox. Once a readable resume is ready and consent is checked, Continue to Resume Analyzer opens the first tool. Next step buttons lead through Job Match Analyzer, Interview Coach, Career Roadmap, and Ask Your Career Coach. Navigate lets you open any page directly. Edit resume and career details returns to Upload Resume. Your extracted resume and details stay available across the tools during this session. Uploading another resume replaces the saved text. Clear my information and reports removes the saved inputs and reports.

## Connect Gemini in Streamlit

Open the deployed app settings and find Secrets. Add GEMINI_API_KEY as a quoted string containing your Google AI Studio API key. Save the secret and allow the app to restart. Keep the key in Streamlit secrets or a server environment variable. Never add it to app.py, README.md, or a GitHub commit. Project name and project number are unnecessary for this API-key connection.

The app uses the existing Python client library with Google's documented Gemini compatibility endpoint using Gemini 3.5 Flash-Lite. Resume Analyzer sends the extracted resume, optional career context and job posting, scoring rubric, and retrieved career guidance. Gemini returns five scores with explanations, strengths, weaknesses, and proposed rewrites. Python validates the rubric, citations, and original excerpts before displaying a result. The other coaching tools use the same Gemini connection. Repeated identical requests may reuse a genuine result already generated during the session.

Free-tier availability and quotas depend on the Google project. Wait and check Google AI Studio if the app reports a quota limit. The dollar estimates shown by the app use paid-tier reference rates for internal guards. They do not verify whether the project is eligible for free usage. Use fictional or redacted documents because free-tier inputs and outputs may be used to improve Google products.

## Welcome information and supported files

Welcome explains the LLM, RAG retrieval, the fixed career workflow, evidence checks, privacy and consent, responsible feedback, supported files, and cost controls. The internship demo files remain in the repository demo folder for classroom preparation.

Upload Resume accepts PDF, Word DOC, and Word DOCX files up to 5 MB. DOCX uses python-docx, PDF uses PyMuPDF, and older DOC files use antiword. Streamlit Community Cloud installs antiword from packages.txt. For a local installation, install antiword through the operating system package manager. On macOS, the built-in textutil reader is used when antiword is unavailable. DOC extraction uses a temporary directory, a 15-second conversion timeout, file signature checks, and the shared extracted-text limits. Conversion failures display guidance to export as PDF or DOCX.

## Recovery from temporary AI failures

For a temporary connection failure, timeout, HTTP 408, or server error, the app makes one backup attempt using Gemini 3.1 Flash-Lite. The primary model is Gemini 3.5 Flash-Lite. Cost estimates use the higher primary-model reference rates for both attempts. Each attempt passes the existing request and budget guards. Authentication, quota, invalid-input, and model-access errors stop with a specific message. Uploaded information remains in the session, so use the same feature button to try again without reloading. Rejected HTTP requests release their reserved cost estimate. Failed calls with unknown usage retain a conservative reservation.

## Resume matched roles and company applications

In Job Match Analyzer, choose Find jobs matching my resume after uploading a resume and providing consent. Gemini suggests up to three student-appropriate roles, each linked to an actual resume excerpt. Each suggestion opens Amazon or Google careers searches for that role. Students choose a current opening, review its requirements, and apply on the employer website. The company application library also links to Microsoft and Amazon student programs. Role suggestions are generated from the resume. Current vacancies and applications are handled by the employer websites. This action uses a separate AI request and the existing recovery and budget controls.
