import { api } from "./api.mjs?v=32964b1965fb";
import { supabaseConfig } from "./supabase-config.mjs?v=32964b1965fb";
import { createSupabaseStorage, confirmationNotice } from "./supabase-storage.mjs?v=32964b1965fb";

const storage = createSupabaseStorage(supabaseConfig);
export const getSessionToken = storage.token;
export function createClassroomRequest() {
  return async function request(path, options) {
    if (["account","saved-jobs","history"].includes(path)) return storage.request(path, options);
    if (path === "chat") return Response.json({ error: "This classroom edition uses on-device AI." }, { status: 503 });
    return api(new Request(new URL("/api/" + path, "https://classroom.invalid"), options));
  };
}

export function bindSupabaseLogin(refreshAccount) {
  const form = document.getElementById("supabase-signin");
  const message = document.getElementById("account-status");
  const logout = document.getElementById("supabase-signout");
  const notice = confirmationNotice(window.location.hash);
  if (notice) {
    // Strip auth credentials and errors from the URL without adopting an unverified session.
    window.history.replaceState({ ...window.history.state, careerStep: "profile" }, "", window.location.pathname + window.location.search + "#profile");
    message.textContent = notice;
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const resend = event.submitter?.value === "resend";
    if (resend && !form.elements.email.reportValidity()) return;
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach(button => { button.disabled = true; });
    const signup = event.submitter?.value === "signup";
    message.textContent = resend ? "Requesting a new confirmation email…" : signup ? "Creating your account…" : "Signing in…";
    try {
      if (resend) {
        await storage.resendConfirmation(form.elements.email.value.trim());
        message.textContent = "If your account still needs confirmation, check your inbox for the newest email. If you already confirmed your email, sign in instead.";
        return;
      }
      const signedIn = await storage.signIn(form.elements.email.value.trim(), form.elements.password.value, signup);
      if (signedIn) {
        await refreshAccount();
        message.textContent = "Signed in. Your saved records are private to your account.";
      } else message.textContent = "Check your email for the newest confirmation link, then sign in. If your email is already confirmed, sign in directly.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      form.elements.password.value = "";
      buttons.forEach(button => { button.disabled = false; });
    }
  });
  logout.addEventListener("click", async () => {
    if (!window.confirm("Sign out? Unsaved work in this tab will be cleared.")) return;
    try { await storage.signOut(); } catch { /* Clear the local token even if the server is offline. */ }
    location.reload();
  });
}
