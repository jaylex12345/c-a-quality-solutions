const { Resend } = require("resend");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_2PBI8u5Ja8mptMnFndFgNg_OCdabfqR";
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

async function supabasePublicRest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase public REST failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : [];
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

  const linkData = await generateAuthLink({ type: "invite", email });
  const userId = linkData.user && linkData.user.id ? linkData.user.id : null;
  const actionLink = linkData.action_link;

  if (!actionLink) {
    throw new Error("Invite link generation failed");
  }

  await supabasePublicRest("drivers", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
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

  await sendDriverInviteEmail({ driverName: name, email, actionLink });

  return { ok: true, message: "Driver invitation sent." };
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");
    const result = await createDriverInvite(body);
    return json(200, result);
  } catch (error) {
    return json(500, { error: error.message || "Unexpected error" });
  }
};