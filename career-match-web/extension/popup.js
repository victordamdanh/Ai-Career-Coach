function fillContactFields(data) {
  const fields = {
    firstName: "#first_name, #first-name, [autocomplete='given-name']",
    lastName: "#last_name, #last-name, [autocomplete='family-name']",
    email: "#email, [autocomplete='email']",
    phone: "#phone, [autocomplete='tel']",
    coverLetter: "textarea#cover_letter, textarea#cover-letter, textarea[name='cover_letter']",
  };
  const filled = [];
  Object.entries(fields).forEach(([key, selector]) => {
    const input = Array.from(document.querySelectorAll(selector)).find(item =>
      (item instanceof HTMLInputElement || item instanceof HTMLTextAreaElement) &&
      item.type !== "hidden" && !item.disabled && !item.readOnly && !item.value && item.getClientRects().length);
    if (!input || typeof data[key] !== "string" || !data[key].trim()) return;
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, data[key]);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    filled.push(key);
  });
  return filled;
}

const message = document.querySelector("#status");
document.querySelector("#fill").addEventListener("click", async () => {
  try {
    const packet = JSON.parse(document.querySelector("#packet").value);
    if (packet.kind !== "ai-career-match-application" || !/^\d+$/.test(String(packet.jobId))) throw new Error("Paste a packet copied from AI Career Match.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const allowed = ["boards.greenhouse.io", "job-boards.greenhouse.io", "job-boards.eu.greenhouse.io"];
    if (url.protocol !== "https:" || !allowed.includes(url.hostname) || url.pathname.split("/").filter(Boolean).at(-1) !== String(packet.jobId)) {
      throw new Error("Open the matching Greenhouse-hosted job form first.");
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: fillContactFields, args: [packet],
    });
    message.textContent = result.length ? "Filled " + result.length + " fields. Review the form, attach your resume, and submit when ready." : "No supported empty fields were found on this page.";
  } catch (error) {
    message.textContent = error.message;
  }
});
