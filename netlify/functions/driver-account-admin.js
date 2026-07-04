const { Resend } = require("resend");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "contact@caqualitysolutions.com";
const SITE_URL = process.env.SITE_URL || "https://caqualitysolutions.com";
const DRIVER_INVITE_EXPIRY_HOURS = Number(process.env.DRIVER_INVITE_EXPIRY_HOURS || 24);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function supabaseRest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

async function supabaseAuth(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Auth failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function accountStatusFromActive(isActive) {
  return isActive ? "Pending Activation" : "Suspended";
}

async function sendDriverInviteEmail({ driverName, email, actionLink }) {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: [email],
    subject: "Welcome to C&A Quality Solutions",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b2d52;max-width:640px;margin:0 auto;">
        <p>Hello ${escapeHtml(driverName)},</p>
        <p>Your driver account has been created.</p>
        <p>Click the button below to create your password and activate your account.</p>
        <p>This link expires in ${DRIVER_INVITE_EXPIRY_HOURS} hours.</p>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(actionLink)}" style="background:#d9b431;color:#071b33;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block;">Create My Password</a>
        </p>
        <p>Welcome to the C&A Quality Solutions team!</p>
      </div>
    `,
  });
}

async function sendDriverResetEmail({ driverName, email, actionLink, forced }) {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const resend = new Resend(RESEND_API_KEY);
  const intro = forced
    ? "An administrator has requested that you reset your password before your next login."
    : "We received a request to reset your driver account password.";

  await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: [email],
    subject: "C&A Quality Solutions Password Reset",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b2d52;max-width:640px;margin:0 auto;">
        <p>Hello ${escapeHtml(driverName)},</p>
        <p>${escapeHtml(intro)}</p>
        <p>Click the button below to choose a new password.</p>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(actionLink)}" style="background:#d9b431;color:#071b33;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block;">Reset Password</a>
        </p>
        <p>If you did not request this, contact dispatch immediately.</p>
      </div>
    `,
  });
}

async function generateAuthLink({ type, email }) {
  const redirectPath = type === "recovery" ? "driver/reset-password.html" : "driver/setup-password.html";
  const redirectTo = `${SITE_URL}/${redirectPath}`;

  return supabaseAuth("admin/generate_link", {
    method: "POST",
    body: {
      type,
      email,
      redirect_to: redirectTo,
      options: {
        redirectTo,
      },
      data: {
        role: "driver",
      },
    },
  });
}

async function getDriverByIdOrEmail({ driverId, email }) {
  if (driverId) {
    const list = await supabaseRest(`drivers?select=*&id=eq.${encodeURIComponent(driverId)}&limit=1`);
    return list[0] || null;
  }

  if (!email) return null;
  const list = await supabaseRest(`drivers?select=*&email=eq.${encodeURIComponent(email)}&limit=1`);
  return list[0] || null;
}

async function createDriverInvite(payload) {
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const phone = String(payload.phone || "").trim();
  const role = "Driver";
  const isActive = payload.isActive !== false;
  const uiStatus = isActive ? "Active" : "Inactive";

  if (!name || !email || !phone) {
    throw new Error("Name, email, and phone are required");
  }

  const existingDriver = await getDriverByIdOrEmail({ email });
  if (existingDriver && existingDriver.account_status === "Active") {
    throw new Error("Driver already exists and is active");
  }

  const linkData = await generateAuthLink({ type: "invite", email });
  const userId = linkData.user && linkData.user.id ? linkData.user.id : null;
  const actionLink = linkData.action_link;

  if (!actionLink) {
    throw new Error("Invite link generation failed");
  }

  if (existingDriver) {
    await supabaseRest(`drivers?id=eq.${encodeURIComponent(existingDriver.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        name,
        email,
        phone,
        role,
        status: uiStatus,
        is_active: isActive,
        auth_user_id: userId || existingDriver.auth_user_id || null,
        account_status: accountStatusFromActive(isActive),
        invited_at: new Date().toISOString(),
        force_password_reset: false,
      },
    });
  } else {
    await supabaseRest("drivers", {
      method: "POST",
      body: {
        name,
        email,
        phone,
        role,
        status: uiStatus,
        is_active: isActive,
        auth_user_id: userId,
        account_status: accountStatusFromActive(isActive),
        invited_at: new Date().toISOString(),
        force_password_reset: false,
      },
    });
  }

  await sendDriverInviteEmail({ driverName: name, email, actionLink });

  return { ok: true, message: "Driver invitation sent." };
}

async function resendInvite(payload) {
  const driver = await getDriverByIdOrEmail(payload);
  if (!driver) throw new Error("Driver not found");

  const linkData = await generateAuthLink({ type: "invite", email: driver.email });
  if (!linkData.action_link) throw new Error("Invite link generation failed");

  await supabaseRest(`drivers?id=eq.${encodeURIComponent(driver.id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      account_status: driver.is_active ? "Pending Activation" : "Suspended",
      invited_at: new Date().toISOString(),
    },
  });

  await sendDriverInviteEmail({
    driverName: driver.name || "Driver",
    email: driver.email,
    actionLink: linkData.action_link,
  });

  return { ok: true, message: "New password setup email sent." };
}

async function forcePasswordReset(payload) {
  const driver = await getDriverByIdOrEmail(payload);
  if (!driver) throw new Error("Driver not found");

  const linkData = await generateAuthLink({ type: "recovery", email: driver.email });
  if (!linkData.action_link) throw new Error("Password reset link generation failed");

  await supabaseRest(`drivers?id=eq.${encodeURIComponent(driver.id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      force_password_reset: true,
    },
  });

  await sendDriverResetEmail({
    driverName: driver.name || "Driver",
    email: driver.email,
    actionLink: linkData.action_link,
    forced: true,
  });

  return { ok: true, message: "Forced password reset email sent." };
}

async function setDriverActivation(payload) {
  const driver = await getDriverByIdOrEmail(payload);
  if (!driver) throw new Error("Driver not found");

  const isActive = payload.isActive === true;
  const accountStatus = isActive
    ? (driver.activated_at ? "Active" : "Pending Activation")
    : "Suspended";

  await supabaseRest(`drivers?id=eq.${encodeURIComponent(driver.id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      is_active: isActive,
      status: isActive ? "Active" : "Inactive",
      account_status: accountStatus,
      suspended_at: isActive ? null : new Date().toISOString(),
    },
  });

  return {
    ok: true,
    message: isActive ? "Driver reactivated." : "Driver suspended.",
  };
}

async function logoutAllDevices(payload) {
  const driver = await getDriverByIdOrEmail(payload);
  if (!driver) throw new Error("Driver not found");
  if (!driver.auth_user_id) throw new Error("Driver auth account is missing");

  await supabaseAuth(`admin/users/${encodeURIComponent(driver.auth_user_id)}/logout`, {
    method: "POST",
  });

  return { ok: true, message: "Driver was logged out of all devices." };
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "").trim();

    if (!action) {
      return json(400, { error: "Action is required" });
    }

    let result;
    if (action === "create_invite") {
      result = await createDriverInvite(body);
    } else if (action === "resend_invite") {
      result = await resendInvite(body);
    } else if (action === "force_password_reset") {
      result = await forcePasswordReset(body);
    } else if (action === "set_activation") {
      result = await setDriverActivation(body);
    } else if (action === "logout_all_devices") {
      result = await logoutAllDevices(body);
    } else {
      return json(400, { error: `Unsupported action: ${action}` });
    }

    return json(200, result);
  } catch (error) {
    return json(500, { error: error.message || "Unexpected error" });
  }
};
