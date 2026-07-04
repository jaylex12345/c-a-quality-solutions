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
  const allowedRoles = ["admin", "super_admin"];

  if (!supabaseClient) {
    window.location.href = loginPath;
    return false;
  }

  try {
    const sessionResult = await supabaseClient.auth.getSession();
    const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;

    if (!session || !session.user) {
      window.location.href = loginPath;
      return false;
    }

    const adminLookup = await supabaseClient
      .from("admin_users")
      .select("id, full_name, email, role")
      .eq("id", session.user.id)
      .in("role", allowedRoles)
      .limit(1)
      .maybeSingle();

    if (adminLookup.error || !adminLookup.data) {
      await supabaseClient.auth.signOut();
      window.location.href = loginPath;
      return false;
    }

    window.__adminUser = adminLookup.data;
    localStorage.setItem("role", adminLookup.data.role || "admin");
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
    try {
      await supabaseClient.auth.signOut();
    } catch (_) {
      // no-op
    }
    window.location.href = loginPath;
    return false;
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
  const loginPath = (options && options.loginPath) || "/login.html";
  const ok = await requireAdminAuth(options || {});
  if (!ok) return false;

  const role =
    window.__adminUser && window.__adminUser.role
      ? String(window.__adminUser.role)
      : "";
  const email =
    window.__adminUser && window.__adminUser.email
      ? String(window.__adminUser.email).toLowerCase()
      : "";

  if (role !== "super_admin" || !SUPER_ADMIN_OWNER_EMAILS.includes(email)) {
    try {
      if (window.supabaseClient && window.supabaseClient.auth) {
        await window.supabaseClient.auth.signOut();
      }
    } catch (_) {
      // no-op
    }
    localStorage.removeItem("role");
    window.location.href = loginPath;
    return false;
  }

  return true;
}
