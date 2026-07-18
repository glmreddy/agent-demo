import { initAuth, getCurrentUser } from "./auth.js";
import { initLoginView, showLoginScreen, hideLoginScreen } from "./views/loginView.js";
import { renderUser, initShell } from "./views/shellView.js";
import { registerView, navigateTo, initNav } from "./router.js";
import { installGlobalErrorHandler } from "./utils/errorBoundary.js";
import { initCache, resetCache } from "./store/cache.js";
import { showToast } from "./utils/toast.js";

import { initDashboardView } from "./views/dashboardView.js";
import { initTransactionsView } from "./views/transactionsView.js";
import { initReportsView } from "./views/reportsView.js";
import { initPaymentCyclesView } from "./views/paymentCyclesView.js";
import { initBudgetView } from "./views/budgetView.js";
import { initCategoryMappingView } from "./views/categoryMappingView.js";
import { initImportView } from "./views/importView.js";

installGlobalErrorHandler();
initNav();
initShell();
initLoginView();

registerView("dashboard", initDashboardView());
registerView("transactions", initTransactionsView());
registerView("reports", initReportsView());
registerView("payment-cycles", initPaymentCyclesView());
registerView("budget", initBudgetView());
registerView("category-mapping", initCategoryMappingView());
registerView("import", initImportView());

let bootstrapped = false;

initAuth(
  async (user) => {
    hideLoginScreen();
    renderUser(user);
    try {
      await initCache(user.uid);
    } catch (err) {
      console.error("Failed to load your data:", err);
      showToast("Couldn't load your data. Please refresh and try again.", "error");
    }
    if (!bootstrapped) {
      navigateTo("dashboard");
      bootstrapped = true;
    } else {
      navigateTo("dashboard");
    }
  },
  () => {
    resetCache();
    bootstrapped = false;
    showLoginScreen();
  }
);
