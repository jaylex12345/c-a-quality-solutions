(function bootstrapAdminVisibility() {
  if (typeof document !== "undefined") {
    document.documentElement.style.visibility = "hidden";
  }
})();

const SUPER_ADMIN_OWNER_EMAILS = [
  "james@caqualitysolutions.com",
  "alexisbright@caqualitysolutions.com",
];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isOwnerAdminEmail(email) {
  return SUPER_ADMIN_OWNER_EMAILS.includes(normalizeEmail(email));
}

function readStoredAdminEmail() {
  try {
    return normalizeEmail(localStorage.getItem("admin_auth_email"));
  } catch (_) {
    return "";
  }
}

function clearSimpleAdminAuth() {
  try {
    localStorage.removeItem("admin_auth_email");
    localStorage.removeItem("admin_auth_ok");
    localStorage.removeItem("role");
  } catch (_) {
    // no-op
  }
}

async function requireAdminAuth(options) {
  const supabaseClient = options && options.supabaseClient;
  const loginPath = (options && options.loginPath) || "/login.html";

  const denyAccess = function () {
    clearSimpleAdminAuth();
    document.documentElement.style.visibility = "visible";
    window.location.href = loginPath;
    return false;
  };

  if (!supabaseClient) {
    const storedEmail = readStoredAdminEmail();
    if (!isOwnerAdminEmail(storedEmail)) {
      return denyAccess();
    }

    document.documentElement.style.visibility = "visible";
    return true;
  }

  try {
    const sessionResult = await supabaseClient.auth.getSession();
    const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    const sessionEmail = normalizeEmail(session && session.user ? session.user.email : "");

    if (!session || !session.user || !isOwnerAdminEmail(sessionEmail)) {
      return denyAccess();
    }

    localStorage.setItem("admin_auth_email", sessionEmail);
    localStorage.setItem("admin_auth_ok", "true");

    const adminLookup = await supabaseClient
      .from("admin_users")
      .select("id, full_name, email, role")
      .eq("id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (!adminLookup.error && adminLookup.data) {
      window.__adminUser = adminLookup.data;
      localStorage.setItem("role", adminLookup.data.role || "admin");
    } else {
      localStorage.setItem("role", "admin");
    }

    if (!document.getElementById("admin-logout-floating")) {
      const button = document.createElement("button");
      button.id = "admin-logout-floating";
      button.innerText = "Logout";
      button.style.position = "fixed";
      button.style.right = "14px";
      button.style.bottom = "14px";
      button.style.zIndex = "9999";
      button.style.border = "0";
      button.style.borderRadius = "10px";
      button.style.padding = "10px 14px";
      button.style.background = "#061b3a";
      button.style.color = "#ffffff";
      button.style.fontWeight = "bold";
      button.style.cursor = "pointer";
      button.addEventListener("click", function () {
        adminLogout(loginPath);
      });
      document.body.appendChild(button);
    }
    document.documentElement.style.visibility = "visible";
    return true;
  } catch (_) {
    return denyAccess();
  }
}

async function adminLogout(loginPath) {
  const redirectPath = loginPath || "/login.html";

  try {
    if (window.supabaseClient && window.supabaseClient.auth) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (_) {
    // no-op
  }

  clearSimpleAdminAuth();
  window.location.href = redirectPath;
  return false;
}

async function requireSuperAdminAuth(options) {
  return requireAdminAuth(options || {});
}
