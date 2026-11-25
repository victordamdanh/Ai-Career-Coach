import { detectInvitation } from "./career-steps.mjs?v=333fe799808a";

const scriptUrl = "https://accounts.google.com/gsi/client";
const scopes = {
  read: "https://www.googleapis.com/auth/gmail.readonly",
  organize: "https://www.googleapis.com/auth/gmail.modify",
  send: "https://www.googleapis.com/auth/gmail.send",
};
let loader;

function identityClient() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.onload = () => resolve(window.google.accounts.oauth2);
    script.onerror = () => { loader = undefined; reject(new Error("Could not load Google sign-in.")); };
    document.head.append(script);
  });
  return loader;
}

function clientIdFrom(input) {
  const clientId = input.trim();
  if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    throw new Error("Enter the Google OAuth web client ID configured for this site.");
  }
  return clientId;
}

async function authorize(clientId, scope, onToken, onError) {
  const oauth = await identityClient();
  oauth.initTokenClient({
    client_id: clientId, scope, include_granted_scopes: false,
    callback: result => {
      if (result.error || !result.access_token || !oauth.hasGrantedAllScopes(result, scope)) {
        onError("Gmail authorization was declined or the requested permission was not granted.");
        return;
      }
      onToken(result.access_token);
    },
    error_callback: () => onError("The Google authorization window did not finish."),
  }).requestAccessToken({ prompt: "consent" });
}

async function gmail(accessToken, path, body) {
  const headers = { authorization: "Bearer " + accessToken };
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
    method: body === undefined ? "GET" : "POST", headers, body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Object.assign(new Error(
    response.status === 401 ? "Gmail access expired. Connect again." : "Gmail could not complete the request."
  ), { status: response.status });
  return response.json();
}

function header(message, name) {
  return message.payload?.headers?.find(item => item.name.toLowerCase() === name)?.value || "";
}
function words(value) {
  return " " + String(value).toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
}

export function linkToApplication(message, tracked) {
  const sender = header(message, "from").match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase();
  const subject = words(header(message, "subject") + " " + (message.snippet || ""));
  const senderText = words(header(message, "from").replace(/<[^>]*>/g, ""));
  const candidates = tracked.filter(job => {
    if (!job.title || !job.company) return false;
    const role = words(job.title);
    const company = words(job.company);
    const fromRecruiter = job.address?.toLowerCase() === sender && !!sender;
    return role.trim() && subject.includes(role) &&
      (fromRecruiter || (company.trim() && (subject.includes(company) || senderText.includes(company))));
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function attachInbox({ $, status, el, onCheck, getTrackedJobs = () => [], onInvitation }) {
  const form = $("gmail");
  const scan = $("scan-inbox");
  const display = $("inbox-matches");
  const seen = new Set();
  let session;
  let interval;
  let scanning = false;
  let connectionAttempt = 0;

  function syncInterval() {
    window.clearInterval(interval);
    interval = session && $("automatic-inbox").checked ? window.setInterval(checkMessages, 120000) : undefined;
  }

  function showConnection() {
    scan.disabled = !session || scanning;
    syncInterval();
  }

  async function labelsFor(activeSession, matches) {
    const listed = await gmail(activeSession.token, "labels");
    const labels = new Map((listed.labels || []).map(label => [label.name, label.id]));
    async function ensureLabel(name) {
      if (!labels.has(name)) {
        const created = await gmail(activeSession.token, "labels", {
          name, labelListVisibility: "labelShow", messageListVisibility: "show",
        });
        labels.set(name, created.id);
      }
      return labels.get(name);
    }
    if (session !== activeSession) return;
    await ensureLabel("Job Applications");
    for (const { message, job } of matches) {
      if (session !== activeSession) return;
      const company = job.company.replace(/[\r\n/]+/g, " ").trim().slice(0, 90);
      if (!company) continue;
      const label = await ensureLabel("Job Applications/" + company);
      if (session !== activeSession) return;
      if (!message.labelIds?.includes(label)) {
        await gmail(activeSession.token, "threads/" + encodeURIComponent(message.threadId) + "/modify", { addLabelIds: [label] });
      }
    }
  }

  async function checkMessages() {
    if (!session || scanning) return;
    const activeSession = session;
    scanning = true;
    scan.disabled = true;
    status("gmail-status", "Checking recent messages…");
    try {
      const tracked = getTrackedJobs();
      const companyQueries = [...new Set(tracked.map(job => job.company.replace(/[^\p{L}\p{N} .-]/gu, "").trim().slice(0, 60)).filter(Boolean))].slice(0, 12);
      const keywords = companyQueries.length ? "{interview " + companyQueries.map(name => '"' + name + '"').join(" ") + "}" : "interview";
      const params = new URLSearchParams({ q: "newer_than:30d in:inbox " + keywords + " -category:promotions", maxResults: "20" });
      const { messages = [] } = await gmail(activeSession.token, "messages?" + params);
      const details = await Promise.all(messages.map(({ id }) => gmail(activeSession.token, "messages/" +
        encodeURIComponent(id) + "?format=full&fields=id,threadId,snippet,labelIds,payload(headers)")));
      if (session !== activeSession) return;
      const linked = details.filter(message => message.threadId).map(message => ({
        message, job: linkToApplication(message, tracked),
      }));
      const invites = [...new Map(linked.filter(({ message, job }) => (!tracked.length || job) && detectInvitation(message.snippet || ""))
        .map(entry => [entry.message.threadId, entry])).values()];
      display.replaceChildren();
      onCheck?.(invites.length > 0);
      status("gmail-status", invites.length ? invites.length + " possible interview invitation(s). Verify them in Gmail." :
        "No interview invitations found in the message previews checked.");
      for (const { message, job } of invites) {
        const title = header(message, "subject") || "Open Gmail message";
        const href = "https://mail.google.com/mail/u/?authuser=0#all/" + encodeURIComponent(message.threadId);
        const link = el("a", title);
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const item = el("li");
        item.append(link);
        if (job) item.append(" · " + job.title + " at " + job.company);
        display.append(item);
        if (!seen.has(message.id)) {
          seen.add(message.id);
          onInvitation?.({ title, href, job });
        }
      }
      const labelable = linked.filter(({ job }) => job);
      if (activeSession.organize && labelable.length) {
        try {
          await labelsFor(activeSession, labelable);
        } catch (error) {
          if (error.status === 401) throw error;
          if (session === activeSession) status("gmail-status", "Inbox check finished. Gmail labels could not be updated.", true);
        }
      }
    } catch (error) {
      if (session !== activeSession) return;
      if (error.status === 401) {
        session = undefined;
        syncInterval();
      }
      status("gmail-status", error.message, true);
    } finally {
      scanning = false;
      scan.disabled = !session;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const attempt = ++connectionAttempt;
    const organize = $("organize-inbox").checked;
    const reportError = reason => {
      if (attempt === connectionAttempt) status("gmail-status", reason, true);
    };
    try {
      await authorize(clientIdFrom($("gmail-client").value), organize ? scopes.organize : scopes.read, token => {
        if (attempt !== connectionAttempt) return;
        session = { token, organize };
        seen.clear();
        showConnection();
        checkMessages();
      }, reportError);
    } catch (error) { reportError(error.message); }
  });
  $("automatic-inbox").addEventListener("change", syncInterval);
  scan.addEventListener("click", checkMessages);
  $("disconnect-inbox").addEventListener("click", () => {
    ++connectionAttempt;
    if (session) window.google.accounts.oauth2.revoke(session.token);
    session = undefined;
    seen.clear();
    showConnection();
    display.replaceChildren();
    status("gmail-status", "Gmail disconnected.");
  });
}

function base64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  }
  return btoa(binary);
}
const utf8 = value => new TextEncoder().encode(value);
const lines = value => value.match(/.{1,76}/g)?.join("\r\n") || "";
const resumeTypes = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export async function applicationMessage({ address, subject, draft, file }, boundary) {
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address) || address.length > 254) {
    throw new Error("Enter one recruiter email address from the posting.");
  }
  if (!draft.trim() || draft.length > 12000) throw new Error("Review and prepare a cover note before sending.");
  const filename = file?.name.replace(/[^\w .-]+/g, "_").slice(-120);
  const type = resumeTypes[filename?.split(".").at(-1)?.toLowerCase()];
  if (!type || !file.size || file.size > 5 * 1024 * 1024) throw new Error("Upload a PDF, DOCX, or TXT resume up to 5 MB to attach.");
  const encodedSubject = Array.from(subject.slice(0, 130)).reduce((chunks, character, index) => {
    if (index % 12 === 0) chunks.push(character);
    else chunks[chunks.length - 1] += character;
    return chunks;
  }, []).map(chunk => "=?UTF-8?B?" + base64(utf8(chunk)) + "?=").join("\r\n ");
  const parts = [
    "To: " + address, "Subject: " + encodedSubject, "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="' + boundary + '"', "",
    "--" + boundary, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64",
    "", lines(base64(utf8(draft))), "",
    "--" + boundary, "Content-Type: " + type, 'Content-Disposition: attachment; filename="' + filename + '"',
    "Content-Transfer-Encoding: base64", "", lines(base64(new Uint8Array(await file.arrayBuffer()))),
    "", "--" + boundary + "--", "",
  ];
  return base64(utf8(parts.join("\r\n"))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function attachRecruiterEmail({ $, status, getApplication, onSent }) {
  const form = $("application-email");
  const button = $("send-recruiter-email");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (button.disabled) return;
    const application = getApplication();
    if (!application?.posting || !application.file || !application.draft.trim()) {
      status("draft-status", "Select a job, upload the resume to attach, and prepare a draft first.", true);
      return;
    }
    const address = $("recruiter-email").value.trim();
    const subject = "Application for " + application.posting.title;
    const recover = reason => { button.disabled = false; status("draft-status", reason, true); };
    try {
      const id = clientIdFrom($("application-gmail-client").value || $("gmail-client").value);
      if (!window.confirm("Send the reviewed application for " + application.posting.title + " to " + address +
          " with " + application.file.name + " attached?")) return;
      button.disabled = true;
      status("draft-status", "Approve Gmail access to send this application.");
      await authorize(id, scopes.send, async token => {
        let sent = false;
        try {
          const raw = await applicationMessage({ ...application, address, subject }, "career-" + crypto.randomUUID());
          await gmail(token, "messages/send", { raw });
          sent = true;
          onSent(application.posting, address);
          form.reset();
          status("draft-status", "Application email sent to " + address + ".");
        } catch (error) {
          status("draft-status", sent ? "Email sent. Mark the application as submitted to track replies." :
            "The send could not be confirmed. Check Gmail Sent before trying again. " + error.message, true);
        } finally { button.disabled = false; }
      }, recover);
    } catch (error) { recover(error.message); }
  });
}
