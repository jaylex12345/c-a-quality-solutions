const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPER_ADMIN_OWNER_EMAILS = new Set([
  "james@caqualitysolutions.com",
  "alexisbright@caqualitysolutions.com",
]);

const ALLOWED_CREATE_ROLES = new Set([
  "admin",
  "dispatcher",
  "driver",
  "customer",
  "super_admin",
]);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function requiredEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
}

async function serviceFetch(path, options = {}) {
  requiredEnv();
  const response = await fetch(`${SUPABASE_URL}${path}`, {
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
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function getCallerFromBearer(accessToken) {
  requiredEnv();

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function requireSuperAdminCaller(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    throw Object.assign(new Error("Missing bearer token"), { statusCode: 401 });
  }

  const accessToken = tokenMatch[1].trim();
  const callerUser = await getCallerFromBearer(accessToken);
  if (!callerUser || !callerUser.id) {
    throw Object.assign(new Error("Invalid session"), { statusCode: 401 });
  }

  const rows = await serviceFetch(
    `/rest/v1/admin_users?select=id,email,role&id=eq.${encodeURIComponent(callerUser.id)}&limit=1`
  );

  const callerAdmin = rows && rows.length ? rows[0] : null;
  const callerEmail = String(callerUser.email || "").toLowerCase();

  if (
    !callerAdmin ||
    callerAdmin.role !== "super_admin" ||
    !SUPER_ADMIN_OWNER_EMAILS.has(callerEmail)
  ) {
    throw Object.assign(new Error("Only owner super_admin users can manage admin signup"), {
      statusCode: 403,
    });
  }

  return { callerUser, callerAdmin };
}

async function listAdminUsers() {
  const rows = await serviceFetch(
    "/rest/v1/admin_users?select=id,full_name,email,role,created_at&order=created_at.desc"
  );
  return rows || [];
}

async function createAuthUser({ email, password, fullName, role }) {
  const created = await serviceFetch("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        requested_role: role,
      },
    },
  });

  if (!created || !created.user || !created.user.id) {
    throw new Error("Auth user creation returned an invalid response");
  }

  return created.user;
}

async function upsertAdminUser({ id, fullName, email, role }) {
  await serviceFetch("/rest/v1/admin_users", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: {
      id,
      full_name: fullName,
      email,
      role,
    },
  });
}

async function insertDriverProfile({ fullName, email, phone, authUserId }) {
  await serviceFetch("/rest/v1/drivers", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: {
      name: fullName,
      email,
      phone: phone || null,
      status: "Active",
      is_active: true,
      role: "Driver",
      account_status: "Active",
      activated_at: new Date().toISOString(),
      auth_user_id: authUserId,
      force_password_reset: false,
    },
  });
}

async function insertCustomerProfile({ fullName, email, phone, password }) {
  await serviceFetch("/rest/v1/customers", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: {
      business_name: fullName,
      contact_person: fullName,
      email,
      phone: phone || null,
      account_status: "Active",
      password,
    },
  });
}

async function createManagedUser(payload) {
  const fullName = String(payload.fullName || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const role = String(payload.role || "").trim().toLowerCase();
  const phone = String(payload.phone || "").trim();

  if (!fullName || !email || !password || !role) {
    throw Object.assign(new Error("fullName, email, password, and role are required"), {
      statusCode: 400,
    });
  }

  if (!ALLOWED_CREATE_ROLES.has(role)) {
    throw Object.assign(new Error("Unsupported role"), { statusCode: 400 });
  }

  const authUser = await createAuthUser({ email, password, fullName, role });

  if (role === "admin" || role === "dispatcher" || role === "super_admin") {
    await upsertAdminUser({
      id: authUser.id,
      fullName,
      email,
      role,
    });
  } else if (role === "driver") {
    await insertDriverProfile({
      fullName,
      email,
      phone,
      authUserId: authUser.id,
    });
  } else if (role === "customer") {
    await insertCustomerProfile({
      fullName,
      email,
      phone,
      password,
    });
  }

  return {
    id: authUser.id,
    email,
    role,
  };
}

async function ensureOwnerRows() {
  const owners = [
    { fullName: "James Kamara", email: "james@caqualitysolutions.com" },
    { fullName: "Alexis Bright", email: "alexisbright@caqualitysolutions.com" },
  ];

  for (const owner of owners) {
    const users = await serviceFetch(
      `/auth/v1/admin/users?email=${encodeURIComponent(owner.email)}`
    );
    const match = users && users.users && users.users.length ? users.users[0] : null;
    if (!match || !match.id) continue;

    await upsertAdminUser({
      id: match.id,
      fullName: owner.fullName,
      email: owner.email,
      role: "super_admin",
    });
  }
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    await requireSuperAdminCaller(event);

    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "").trim();

    if (action === "list_admin_users") {
      await ensureOwnerRows();
      const users = await listAdminUsers();
      return json(200, { users });
    }

    if (action === "create_user") {
      const user = await createManagedUser(body);
      return json(200, { message: "User created successfully.", user });
    }

    if (action === "ensure_owner_rows") {
      await ensureOwnerRows();
      return json(200, { message: "Owner rows ensured." });
    }

    return json(400, { error: "Unsupported action" });
  } catch (error) {
    const statusCode = error && error.statusCode ? Number(error.statusCode) : 500;
    return json(statusCode, { error: error.message || "Unexpected error" });
  }
};
