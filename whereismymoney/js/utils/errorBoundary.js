import { showToast } from "./toast.js";

// Global safety net: an unexpected error anywhere in the app should surface
// as a toast instead of silently white-screening the SPA.
export function installGlobalErrorHandler() {
  window.addEventListener("error", (e) => {
    console.error("Unhandled error:", e.error || e.message);
    showToast("Something went wrong. Please try again.", "error");
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise rejection:", e.reason);
    showToast("Something went wrong. Please try again.", "error");
  });
}
