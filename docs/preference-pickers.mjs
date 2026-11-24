import { levelChoices, preferenceWords, salaryChoices, states } from "./job-preferences.mjs?v=8ee896347678";

const commonTitles = [
  "Data Analyst", "Data Engineer", "Data Scientist", "Business Analyst", "Business Intelligence Analyst", "Software Engineer",
  "Frontend Developer", "Backend Developer", "Full Stack Developer", "Machine Learning Engineer", "AI Engineer",
  "IT Support Specialist", "Systems Analyst", "Cybersecurity Analyst", "Network Engineer", "Cloud Engineer", "DevOps Engineer",
  "Product Manager", "Project Manager", "Technical Program Manager", "Operations Manager", "Accountant", "Financial Analyst",
  "Administrative Assistant", "Office Manager", "Customer Service Representative", "Sales Representative", "Account Manager",
  "Marketing Specialist", "Graphic Designer", "UX Designer", "Research Assistant", "Human Resources Specialist", "Recruiter",
  "Registered Nurse", "Medical Assistant", "Pharmacy Technician", "Teacher", "Retail Associate", "Warehouse Associate",
  "Electrician", "Maintenance Technician", "Mechanical Engineer", "Civil Engineer", "Delivery Driver", "Chef",
];

const commonPlaces = ["Any location", "Remote", "Hybrid", ...Object.values(states),
  "Boston, MA", "Chicago, IL", "Dallas, TX", "Houston, TX", "Los Angeles, CA", "New York, NY", "Phoenix, AZ", "San Francisco, CA",
  "San Jose, CA", "Seattle, WA", "Tucson, AZ", "Washington, DC"];

let catalogRequest;
function loadCatalog() {
  catalogRequest ??= import("./preference-catalog.mjs?v=8ee896347678").then(({ catalog }) => {
    const bytes = Uint8Array.from(atob(catalog), character => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).json();
  });
  return catalogRequest;
}

function searchable(values) {
  const unique = new Map();
  for (const text of values) {
    const key = preferenceWords(text);
    if (!unique.has(key)) unique.set(key, { key, text });
  }
  return [...unique.values()];
}

function findOptions(entries, query) {
  const words = preferenceWords(query).split(" ").filter(Boolean);
  if (!words.length) return entries.slice(0, 70);
  const term = words.join(" ");
  const exact = [];
  const starts = [];
  const others = [];
  for (const entry of entries) {
    if (entry.key === term) exact.push(entry);
    else if (starts.length < 50 && entry.key.startsWith(term)) starts.push(entry);
    else if (others.length < 50 && words.every(word => entry.key.includes(word))) others.push(entry);
  }
  return [...exact, ...starts, ...others].slice(0, 50);
}

function attachPicker(input, label, defaults, external) {
  const root = input.parentElement;
  const toggle = document.createElement("button");
  const list = document.createElement("ul");
  toggle.type = "button";
  toggle.tabIndex = -1;
  toggle.textContent = "▾";
  toggle.setAttribute("aria-label", "Show " + label.toLowerCase() + " choices");
  list.hidden = true;
  list.className = "preference-options";
  list.id = input.id + "-choices";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", label + " choices");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");
  root.append(toggle, list);

  let entries = searchable(defaults);
  let expandedCatalog;
  let query = "";
  let choices = [];
  let active = -1;
  let selecting = false;

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function setActive(index) {
    if (active >= 0) list.children[active].setAttribute("aria-selected", "false");
    active = index;
    const option = list.children[active];
    option.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  }

  function render() {
    active = -1;
    input.removeAttribute("aria-activedescendant");
    choices = findOptions(entries, query);
    list.replaceChildren(...choices.map(({ text }, index) => {
      const option = document.createElement("li");
      option.id = list.id + "-" + index;
      option.dataset.index = index;
      option.textContent = text;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      return option;
    }));
    if (!choices.length) {
      const message = document.createElement("li");
      message.className = "picker-message";
      message.textContent = "You can keep the value you typed.";
      list.append(message);
    }
    list.scrollTop = 0;
  }

  function open(value) {
    query = value;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    render();
    if (external && !expandedCatalog) {
      expandedCatalog = loadCatalog().then(data => {
        entries = searchable([...defaults, ...external(data)]);
        if (!list.hidden) render();
      }).catch(() => {});
    }
  }

  function select(index) {
    const { text } = choices[index];
    selecting = true;
    input.value = text.startsWith("Any ") ? "" : text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    selecting = false;
    close();
    input.focus();
  }

  input.addEventListener("input", () => { if (!selecting) open(input.value); });
  input.addEventListener("keydown", event => {
    if (event.isComposing) return;
    if (event.key === "Escape" && !list.hidden) {
      event.preventDefault();
      close();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) open("");
      if (!choices.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const index = active < 0 && direction < 0 ? choices.length - 1 : (active + direction + choices.length) % choices.length;
      setActive(index);
    }
    if (event.key === "Enter" && !list.hidden && active >= 0) {
      event.preventDefault();
      select(active);
    }
  });
  toggle.addEventListener("mousedown", event => event.preventDefault());
  toggle.addEventListener("click", () => {
    const wasClosed = list.hidden;
    input.focus();
    if (wasClosed) open("");
    else close();
  });
  list.addEventListener("mousedown", event => { if (event.target.closest("[role=option]")) event.preventDefault(); });
  list.addEventListener("click", event => {
    const option = event.target.closest("[role=option]");
    if (option) select(Number(option.dataset.index));
  });
  root.addEventListener("focusout", event => { if (!root.contains(event.relatedTarget)) close(); });
}

export function attachPreferencePickers($) {
  attachPicker($("role"), "Job title", commonTitles, ([titles]) => titles);
  attachPicker($("place"), "Location", commonPlaces, ([, places]) => places);
  attachPicker($("level"), "Level or employment type", ["Any level", ...levelChoices]);
  attachPicker($("pay"), "Salary range", ["Any range", ...salaryChoices]);
}
