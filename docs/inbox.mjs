import { detectInvitation } from "./career-steps.mjs?v=0121d319f728";

const scriptUrl = "https://accounts.google.com/gsi/client";
const scope = "https://www.googleapis.com/auth/gmail.readonly";
let loader;
let token;

function identityClient() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.onload = resolve;
    script.onerror = () => { loader = undefined; reject(new Error("Could not load Google sign-in.")); };
    document.head.append(script);
  });
  return loader;
}

async function gmail(path) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
    headers: { authorization: "Bearer " + token },
  });
  if (response.status === 401) token = undefined;
  if (!response.ok) throw new Error("Gmail could not return messages. Check your authorization and OAuth setup.");
  return response.json();
}

export function attachInbox({ $, status, el }) {
  const form = $("gmail");
  const scan = $("scan-inbox");
  const display = $("inbox-matches");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const clientId = $("gmail-client").value.trim();
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) return status("gmail-status", "Enter the Google OAuth web client ID configured for this site.", true);
    try {
      await identityClient();
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope,
        callback: result => {
          if (result.error || !result.access_token) return status("gmail-status", "Gmail authorization was declined or failed.", true);
          token = result.access_token;
          scan.disabled = false;
          scan.click();
        },
        error_callback: () => status("gmail-status", "The Google authorization window did not finish.", true),
      });
      client.requestAccessToken({ prompt: "consent" });
    } catch (error) { status("gmail-status", error.message, true); }
  });
  scan.addEventListener("click", async () => {
    if (!token) return;
    scan.disabled = true;
    status("gmail-status", "Checking recent interview-related messages…");
    display.replaceChildren();
    try {
      const params = new URLSearchParams({ q: "newer_than:30d in:inbox interview -category:promotions", maxResults: "20" });
      const { messages = [] } = await gmail("messages?" + params);
      const details = await Promise.all(messages.map(({ id }) => gmail("messages/" + encodeURIComponent(id) + "?format=full")));
      const matches = details.filter(message => detectInvitation(message.snippet ?? ""));
      status("gmail-status", matches.length ? matches.length + " possible interview invitation(s). Verify them in Gmail." : "No invitations detected in the message previews searched.");
      for (const message of matches) {
        const item = el("li");
        const title = message.payload?.headers?.find(header => header.name.toLowerCase() === "subject")?.value || "Open Gmail message";
        const link = el("a", title);
        link.href = "https://mail.google.com/mail/u/?authuser=0#all/" + encodeURIComponent(message.threadId);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(link);
        display.append(item);
      }
    } catch (error) { status("gmail-status", error.message, true); }
    finally { scan.disabled = !token; }
  });
  $("disconnect-inbox").addEventListener("click", () => {
    if (token) window.google.accounts.oauth2.revoke(token);
    token = undefined;
    scan.disabled = true;
    display.replaceChildren();
    status("gmail-status", "Gmail disconnected.");
  });
}
