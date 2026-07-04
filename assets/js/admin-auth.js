(function bootstrapAdminVisibility() {
  if (typeof document !== "undefined") {
    document.documentElement.style.visibility = "hidden";
  }
})();

const SUPER_ADMIN_OWNER_EMAILS = [
  "james@caqualitysolutions.com",
  "alexisbright@caqualitysolutions.com",
];

async function requireAdminAuth(options) {
  const supabaseClient = options && options.supabaseClient;
  const loginPath = (options && options.loginPath) || "/login.html";

  if (!supabaseClient) {
    document.documentElement.style.visibility = "visible";
    return true;
  }

  try {
    const sessionResult = await supabaseClient.auth.getSession();
    const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;

    if (session && session.user) {
      const adminLookup = await supabaseClient
        .from("admin_users")
        .select("id, full_name, email, role")
        .eq("id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!adminLookup.error && adminLookup.data) {
        window.__adminUser = adminLookup.data;
        localStorage.setItem("role", adminLookup.data.role || "admin");
      }
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
    document.documentElement.style.visibility = "visible";
    return true;
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

  localStorage.removeItem("role");
  window.location.href = redirectPath;
  return false;
}

async function requireSuperAdminAuth(options) {
  return requireAdminAuth(options || {});
}
