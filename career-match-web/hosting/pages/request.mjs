import { api } from "./api.mjs";
import { supabaseConfig } from "./supabase-config.mjs";
import { createSupabaseStorage } from "./supabase-storage.mjs";

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
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach(button => { button.disabled = true; });
    const signup = event.submitter?.value === "signup";
    message.textContent = signup ? "Creating your account…" : "Signing in…";
    try {
      const signedIn = await storage.signIn(form.elements.email.value.trim(), form.elements.password.value, signup);
      if (signedIn) {
        await refreshAccount();
        message.textContent = "Signed in. Your saved records are private to your account.";
      } else message.textContent = "Check your email for the confirmation link, then return here to sign in.";
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
