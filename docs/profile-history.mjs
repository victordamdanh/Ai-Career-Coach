import { historyLink, normalizeHistory } from "./history-records.mjs?v=32964b1965fb";

export function attachProfileHistory({ $, el, status, request, json, officialLink, getResume, loadResume }) {
  const resumeName = $("history-resume-name");
  const saveResume = $("save-resume-record");
  let ready = false, saved = [], pending = [], activeResume, retryResume, generation = 0;
  const message = (text, error = false) => status("history-status", text, error);
  const stamp = value => new Date(value).toLocaleString();
  function syncResume() {
    const r = getResume();
    if (activeResume?.payload.text !== r.text) activeResume = undefined;
    if (retryResume?.payload.text !== r.text) retryResume = undefined;
    if (!resumeName.value && r.filename) resumeName.value = r.filename.replace(/\.[^.]+$/, "").slice(0, 100);
    saveResume.disabled = !ready || r.text.length < 20;
  }
  function resumeReference() {
    const r = getResume();
    return { resumeId: activeResume?.id ?? null, resumeName: activeResume?.name || r.filename.slice(0, 300) || (r.text ? "Unsaved resume" : "") };
  }
  function makeButton(label, fn, cls = "secondary") {
    const button = el("button", label, cls);
    button.type = "button";
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      try { await fn(); } catch (error) { message(error.message, true); }
      finally { button.disabled = false; syncResume(); }
    });
    return button;
  }
  async function persist(record) {
    if (!ready) throw new Error("Sign in to save this record.");
    const value = normalizeHistory(record);
    await request("history", json("POST", value));
    saved = [value, ...saved.filter(item => item.id !== value.id)];
    return value;
  }
  async function remove(record) {
    if (!window.confirm("Delete saved record “" + record.name + "”?")) return;
    await request("history", json("DELETE", { id: record.id }));
    saved = saved.filter(item => item.id !== record.id);
    if (activeResume?.id === record.id) activeResume = undefined;
    render();
    message("Record deleted.");
  }
  function resumeCard(record) {
    const card = el("article", "", "history-card");
    const details = el("details");
    details.append(el("summary", "View extracted text"), el("p", record.payload.text, "history-text"));
    const actions = el("div", "", "buttons");
    actions.append(makeButton("Load resume", () => {
      if (loadResume(record) !== false) {
        activeResume = record;
        resumeName.value = record.name;
        syncResume();
        message("Loaded " + record.name + ".");
      }
    }), makeButton("Delete", () => remove(record)));
    card.append(el("h3", record.name), el("p", [stamp(record.createdAt), record.payload.filename].filter(Boolean).join(" · "), "hint"), details, actions);
    return card;
  }
  function interviewCard(record, unsaved = false) {
    const p = record.payload, card = el("article", "", "history-card");
    card.append(el("h3", record.name), el("p", [stamp(record.createdAt), p.role, p.company, p.level].filter(Boolean).join(" · "), "hint"),
      el("p", p.score + "/100 · " + p.mode), el("p", "Resume: " + (p.resumeName || "Not linked"), "hint"));
    if (historyLink(p.sourceUrl)) card.append(officialLink(p.sourceUrl, "Original job posting"));
    const details = el("details");
    const notes = el("ul");
    notes.append(...p.feedback.map(note => el("li", note)));
    details.append(el("summary", "View score, feedback and transcript"), el("p", p.criteria.map(item => item.name + " " + item.points + "/20").join(" · ")), notes);
    for (const turn of p.turns) details.append(el("strong", turn.question), el("p", turn.answer + (turn.truncated ? " [Transcript shortened]" : ""), "history-text"));
    card.append(details);
    if (unsaved) {
      const label = el("label", "Name this interview");
      const input = el("input");
      input.value = record.name;
      input.maxLength = 100;
      input.addEventListener("input", () => { record.name = input.value; });
      label.append(input);
      const actions = el("div", "", "buttons");
      actions.append(makeButton("Save interview", async () => {
        await persist({ ...record, name: input.value });
        pending = pending.filter(item => item.id !== record.id);
        render();
        message("Interview saved.");
      }, ""), makeButton("Discard unsaved record", () => {
        if (!window.confirm("Discard this unsaved interview feedback?")) return;
        pending = pending.filter(item => item.id !== record.id);
        render();
      }));
      card.append(el("p", "Not saved yet", "hint"), label, actions);
    } else card.append(makeButton("Delete", () => remove(record)));
    return card;
  }
  function render() {
    const ordered = [...saved].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const resumes = ordered.filter(r => r.kind === "resume"), interviews = ordered.filter(r => r.kind === "interview");
    $("resume-history").replaceChildren(...(resumes.length ? resumes.map(resumeCard) : [el("p", "No saved resumes yet.", "hint")]));
    $("interview-history").replaceChildren(...(interviews.length ? interviews.map(r => interviewCard(r)) : [el("p", "No saved interviews yet.", "hint")]));
    $("pending-interviews").replaceChildren(...pending.map(r => interviewCard(r, true)));
    $("pending-note").hidden = !pending.length;
    syncResume();
  }
  async function setAccount(data) {
    const current = ++generation;
    ready = data.available === "ready";
    $("history-panel").hidden = !ready;
    if (!ready) { saved = []; activeResume = undefined; render(); return; }
    try {
      const data = await request("history");
      if (current !== generation) return;
      saved = (data.records || []).flatMap(item => {
        try { return [normalizeHistory(item)]; } catch { return []; }
      });
      render();
    } catch (error) { if (current === generation) message(error.message, true); }
  }
  saveResume.addEventListener("click", async () => {
    if (!ready || saveResume.disabled) return;
    saveResume.disabled = true;
    try {
      const r = getResume(), name = resumeName.value.trim();
      if (!name) throw new Error("Give your resume a name.");
      if (r.text.length < 20) throw new Error("Upload a readable resume first.");
      const record = retryResume && retryResume.name === name && retryResume.payload.text === r.text ? retryResume :
        { id: crypto.randomUUID(), kind: "resume", name, createdAt: new Date().toISOString(), payload: { text: r.text, filename: r.filename.slice(0, 300) } };
      retryResume = record;
      activeResume = await persist(record);
      retryResume = undefined;
      render();
      message("Resume saved.");
    } catch (error) { message(error.message, true); }
    finally { syncResume(); }
  });
  function addInterview(session, reference = {}) {
    if (!session) return;
    const name = [session.role || "Practice interview", session.company].filter(Boolean).join(" · ").slice(0, 100);
    pending.unshift(normalizeHistory({
      id: crypto.randomUUID(), kind: "interview", name, createdAt: session.createdAt,
      payload: { ...session, ...reference },
    }));
    render();
  }
  return { setAccount, syncResume, resumeReference, addInterview };
}
