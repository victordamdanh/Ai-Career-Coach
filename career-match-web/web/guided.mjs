const MAX_APPLICATIONS = 4;

export function applicationKey(posting) {
  return [posting.provider || "greenhouse", posting.companyId || posting.company, posting.id].join("/");
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

  function clear() {
    ++generation;
    selected.clear();
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
        const button = el("button", "Review application draft", "secondary");
        button.type = "button";
        button.addEventListener("click", () => review(entry));
        item.append(button);
      }
      return item;
    }));
  }

  prepareButton.addEventListener("click", async () => {
    if (editing || !selected.size || !isGuided()) return;
    const current = ++generation;
    const selection = [...selected.values()];
    editing = true;
    results = [];
    list.replaceChildren();
    update();
    for (const { posting, loadPosting } of selection) {
      try {
        status("guided-status", "Preparing " + (results.length + 1) + " of " + selection.length + " applications…");
        const ready = await loadPosting();
        if (current !== generation) break;
        const work = await prepare(ready);
        if (current !== generation) break;
        results.push({ posting: ready, ...work });
      } catch (error) {
        if (current !== generation) break;
        results.push({ posting, error: error.message || "Could not prepare this application." });
      }
    }
    if (current === generation) {
      showResults();
      status("guided-status", "Review the match and each draft before applying.");
    }
    editing = false;
    update();
  });

  function markSubmitted(posting, address) {
    const key = applicationKey(posting);
    tracked.set(key, { company: posting.company, title: posting.title, excerpt: posting.excerpt,
      priorities: posting.priorities, address: address || tracked.get(key)?.address });
    onSubmitted(tracked.size);
  }

  update();
  return { clear, update, selectionControl, markSubmitted, trackedJobs: () => [...tracked.values()] };
}
