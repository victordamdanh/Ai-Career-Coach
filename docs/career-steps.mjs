import { attachInterview } from "./interview.mjs?v=75aed0da0e79";
import { resumeExcerpt, resumeLimit, reviewResume } from "./resume-review.mjs?v=75aed0da0e79";

export async function extractResume(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Use a resume file up to 5 MB.");
  const format = file.name.toLowerCase().split(".").at(-1);
  if (format === "txt") return file.text();
  if (format === "pdf") {
    const cdn = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/";
    const pdfjs = await import(cdn + "pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = cdn + "pdf.worker.min.mjs";
    const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
    try {
      const document = await task.promise;
      const pages = [];
      for (let number = 1; number <= Math.min(document.numPages, 10); number++) {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => (item.str || "") + (item.hasEOL ? "\n" : " ")).join(""));
      }
      return pages.join("\n");
    } finally {
      await task.destroy();
    }
  }
  if (format === "docx") {
    if (!window.mammoth) await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("The Word reader could not load."));
      document.head.append(script);
    });
    return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  throw new Error("Choose a PDF, DOCX, or TXT file.");
}

export function detectInvitation(text) {
  const sample = text.toLowerCase();
  if (/\b(unfortunately|regret to inform|move forward with other|position has been filled|will not be moving forward|not selected|no longer under consideration)\b/.test(sample)) return false;
  return /\binterview\b/.test(sample) && /\b(invite|invitation|schedule|availability|available|confirm|booking)\b/.test(sample);
}

const interviewCriteria = ["relevance", "specificity", "structure", "action", "result"];
const interviewStopWords = new Set("what when where which would could should describe discuss explain share tell talk about your experience example how with this that from were have been role answer time them they".split(" "));

export function reviewInterviewAnswer(question, answer, response) {
  const criteria = interviewCriteria.map(name => ({ name, points: response?.scores?.[name] }));
  const feedback = response?.feedback;
  if (criteria.every(({ points }) => Number.isInteger(points) && points >= 0 && points <= 20) &&
    Array.isArray(feedback) && feedback.length === 3 && feedback.every(note => typeof note === "string" && note.trim() && note.length <= 500)) {
    return { criteria, feedback, mode: "AI feedback" };
  }

  const answerWords = answer.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const terms = [...new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].filter(term => !interviewStopWords.has(term));
  const shared = terms.filter(term => answerWords.includes(term)).length;
  const actions = /\b(?:built|created|analyzed|designed|fixed|implemented|tested|measured|led|reviewed|wrote|used|changed|checked|chose|compared|applied)\b/i.test(answer);
  const situation = /\b(?:when|during|project|team|problem|task|client|customer)\b/i.test(answer);
  const result = /\b(?:result|outcome|reduced|improved|increased|completed|saved|learned|delivered|decreased|resolved)\b/i.test(answer);
  const number = /\b\d+/.test(answer);
  const method = /\b(?:using|with|by|via)\b/i.test(answer);
  const checklist = [
    [Math.min(20, 4 + 4 * shared), "Start with a sentence that answers the question directly."],
    [6 + 5 * Number(number) + 5 * Number(method) + 4 * Number(answerWords.length >= 45), "Name the tool, method, or constraint that shaped your decision."],
    [5 + 5 * Number(situation) + 5 * Number(actions) + 5 * Number(result), "Organize the answer around the situation, your action, and the result."],
    [actions ? 16 : 6, "Explain what you personally did and why you chose that approach."],
    [5 + 10 * Number(result) + 5 * Number(result && number), "End with a concrete outcome you can verify or explain what you learned."],
  ];
  return {
    mode: "Checklist feedback",
    criteria: checklist.map(([points], index) => ({ name: interviewCriteria[index], points })),
    feedback: [...checklist].sort((a, b) => a[0] - b[0]).slice(0, 3).map(([, note]) => note),
  };
}

export function attachCareerSteps({
  $, status, el, browserModel, onResume,
  onReview, onInboxCheck, getInterviewContext, refreshInterviewContext, onInterviewFeedback,
}) {
  let uploadedFile;
  let uploadVersion = 0;

  $("file").addEventListener("change", async event => {
    const file = event.currentTarget.files[0];
    if (!file) return;
    const current = ++uploadVersion;
    uploadedFile = undefined;
    status("upload-status", "Scanning the file locally…");
    try {
      const extracted = (await extractResume(file)).trim();
      if (current !== uploadVersion) return;
      if (extracted.length < 20) throw new Error("Very little text could be read. Upload a text-readable PDF, DOCX, or TXT file.");
      $("extracted").value = extracted.slice(0, resumeLimit);
      $("extraction").open = true;
      uploadedFile = file;
      onResume($("extracted").value, file);
      status("upload-status", extracted.length > resumeLimit ? "Extracted the first 14,000 characters. Review and edit the text." : "Resume scanned. Review the extracted text or continue.");
    } catch (error) {
      if (current === uploadVersion) status("upload-status", error.message, true);
    }
  });
  $("extracted").addEventListener("input", () => onResume($("extracted").value.slice(0, resumeLimit), uploadedFile));

  function showResumeReview() {
    const resume = $("resume").value.trim();
    if (resume.length < 20) {
      status("review-status", "Upload your resume first.", true);
      return;
    }
    const focus = [$("role").value, $("target-description").value].filter(Boolean).join("\n");
    const report = reviewResume(resume, focus);
    const panel = $("resume-analysis");
    panel.replaceChildren(el("h3", "Resume quality · " + report.total + "/100"),
      el("p", "Checklist score based on the resume text.", "hint"));
    const rows = el("ul", "", "resume-scores");
    for (const { name, points, explanation } of report.criteria) {
      const row = el("li");
      row.append(el("strong", name + " · " + points + "/20"), el("p", explanation));
      rows.append(row);
    }
    panel.append(rows);
    onReview?.(report);
    status("review-status", "Score ready.");
    return { resume, focus };
  }

  $("analyze-resume").addEventListener("click", showResumeReview);
  $("review-ai").addEventListener("click", async event => {
    const inputs = showResumeReview();
    if (!inputs) return;
    const button = event.currentTarget;
    const output = $("review-ai-result");
    button.disabled = true;
    output.replaceChildren();
    try {
      status("review-status", "Preparing AI feedback…");
      const generate = await browserModel(progress => status("review-status", "Loading AI feedback (" + progress + "%)…"), { fast: true });
      const advice = el("p", "", "sample-text");
      output.append(el("h3", "AI feedback"), advice);
      const text = await generate(
        "You are a concise career coach. Only use the supplied resume text. Avoid inventing results, experience, or numbers.",
        "Name one strength and give one concrete improvement. Use a placeholder for any missing outcome.",
        { messages: [{ role: "user", text: resumeExcerpt(inputs.resume, inputs.focus, 2200) }], context: inputs.focus ? { target: inputs.focus.slice(0, 400) } : undefined },
        { maxTokens: 210, onPartial: value => { advice.textContent = value; } },
      );
      if ($("resume").value.trim() !== inputs.resume) return;
      advice.textContent = text;
      status("review-status", "Score and AI feedback ready.");
    } catch {
      if ($("resume").value.trim() !== inputs.resume) return;
      output.replaceChildren();
      status("review-status", "Your score is ready. AI feedback is temporarily unavailable.", true);
    } finally {
      button.disabled = false;
    }
  });

  $("load-message").addEventListener("click", () => {
    $("recruiter-message").value = "Hi Jordan, we would like to invite you to an interview for the Data Analyst role. Please reply with your availability next week so we can schedule a call.";
  });
  $("check-message").addEventListener("click", () => {
    const text = $("recruiter-message").value.trim();
    if (!text) return status("mail-status", "Enter a recruiter email first.", true);
    const invited = detectInvitation(text);
    status("mail-status", invited ? "Possible interview invitation detected. Verify the sender and any dates in the original message." : "No interview invitation detected. Review the original message if it is ambiguous.");
    onInboxCheck?.(invited);
  });
  return attachInterview({
    $, status, el, browserModel, getInterviewContext, refreshInterviewContext, reviewAnswer: reviewInterviewAnswer,
    onFeedback: onInterviewFeedback,
  });
}
