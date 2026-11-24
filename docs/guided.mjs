const MAX_APPLICATIONS = 4;

export function applicationKey(posting) {
  return [posting.provider || "greenhouse", posting.companyId || posting.company, posting.id].join("/");
}

export function shortlistOpenings(groups) {
  const shortlist = [];
  const seen = new Set();
  const longest = Math.max(0, ...groups.map(group => group.jobs.length));
  for (let position = 0; position < longest && shortlist.length < MAX_APPLICATIONS; position++) {
    for (const group of groups) {
      const posting = group.jobs[position];
      if (!posting || seen.has(applicationKey(posting))) continue;
      seen.add(applicationKey(posting));
      shortlist.push(posting);
      if (shortlist.length === MAX_APPLICATIONS) break;
    }
  }
  return shortlist;
}

export function createApplicationQueue({ $, el, status, sourceLink, prepare, review, isGuided, onSubmitted }) {
  const panel = $("guided-shortlist");
  const list = $("guided-applications");
  const prepareButton = $("prepare-applications");
  const selected = new Map();
  const tracked = new Map();
  let editing = false;
  let generation = 0;
  let results = [];

  function update() {
    panel.hidden = !isGuided();
    prepareButton.disabled = editing || selected.size === 0;
    prepareButton.textContent = selected.size ? "Prepare " + selected.size + " selected application(s)" : "Prepare selected applications";
    $("guided-selection").textContent = selected.size + " of " + MAX_APPLICATIONS + " openings selected.";
  }

  function syncSelectionControls() {
    for (const id of ["matched-companies", "listings"]) {
      for (const box of $(id).querySelectorAll("[data-application-key]")) {
        box.checked = selected.has(box.dataset.applicationKey);
      }
    }
  }

  function clear() {
    ++generation;
    selected.clear();
    syncSelectionControls();
    results = [];
    list.replaceChildren();
    status("guided-status");
    update();
  }

  function selectionControl(posting, loadPosting) {
    const wrapper = el("label", "", "check-label");
    wrapper.hidden = !isGuided();
    const box = el("input");
    box.type = "checkbox";
    const key = applicationKey(posting);
    box.dataset.applicationKey = key;
    box.checked = selected.has(key);
    box.addEventListener("change", () => {
      if (editing || (box.checked && selected.size >= MAX_APPLICATIONS && !selected.has(key))) {
        box.checked = selected.has(key);
        status("guided-status", editing ? "Wait for the current drafts to finish." : "Select up to " + MAX_APPLICATIONS + " jobs at a time.");
        return;
      }
      if (box.checked) selected.set(key, { posting, loadPosting });
      else selected.delete(key);
      status("guided-status");
      update();
    });
    wrapper.append(box, " Add to application shortlist");
    return wrapper;
  }

  function showResults() {
    list.replaceChildren(...results.map(entry => {
      const item = el("li");
      const name = entry.posting.title + " · " + entry.posting.company;
      item.append(el("strong", name));
      if (entry.error) {
        item.append(el("p", entry.error, "hint"), sourceLink(entry.posting.url, "Open source posting"));
      } else {
        item.append(el("p", entry.report.rubric.score + "% qualification alignment · " +
          (entry.report.mode === "live" ? "Live AI" : "Source-based comparison"), "hint"));
        const button = el("button", entry.draft ? "Review application draft" : "Review job match", "secondary");
        button.type = "button";
        button.addEventListener("click", () => review(entry));
        item.append(button);
      }
      return item;
    }));
  }

  async function prepareSelected({ automatic = false, onProgress = () => {} } = {}) {
    if (editing || !selected.size || !isGuided()) return [];
    const current = ++generation;
    const selection = [...selected.values()];
    editing = true;
    results = [];
    list.replaceChildren();
    update();
    for (const { posting, loadPosting } of selection) {
      try {
        const progress = "Preparing application " + (results.length + 1) + " of " + selection.length + " for " + posting.company + "…";
        status("guided-status", progress);
        onProgress(progress);
        const ready = await loadPosting();
        if (current !== generation) break;
        const work = await prepare(ready, { automatic });
        if (current !== generation) break;
        results.push({ posting: ready, ...work });
      } catch (error) {
        if (current !== generation) break;
        results.push({ posting, error: error.message || "Could not prepare this application." });
      }
    }
    const prepared = current === generation;
    if (prepared) {
      results.sort((a, b) => Number(Boolean(b.draft)) - Number(Boolean(a.draft)) ||
        (b.report?.rubric.score ?? -1) - (a.report?.rubric.score ?? -1));
      showResults();
      status("guided-status", results.some(entry => entry.draft) ?
        "Review the match and each draft before applying." : "No draft had enough resume evidence. Review a result or select other jobs.");
    }
    editing = false;
    update();
    return prepared ? results.filter(entry => entry.draft) : [];
  }

  prepareButton.addEventListener("click", () => prepareSelected());

  async function prepareAutomatic(groups, loadPosting, onProgress) {
    if (editing || !isGuided()) return [];
    clear();
    for (const posting of shortlistOpenings(groups)) {
      selected.set(applicationKey(posting), { posting, loadPosting: () => loadPosting(posting) });
    }
    syncSelectionControls();
    return prepareSelected({ automatic: true, onProgress });
  }

  function markSubmitted(posting, address) {
    const key = applicationKey(posting);
    tracked.set(key, { company: posting.company, title: posting.title, excerpt: posting.excerpt,
      priorities: posting.priorities, address: address || tracked.get(key)?.address });
    onSubmitted(tracked.size);
  }

  update();
  return { clear, update, selectionControl, prepareAutomatic, markSubmitted, trackedJobs: () => [...tracked.values()] };
}
