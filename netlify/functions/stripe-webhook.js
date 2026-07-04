const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "contact@caqualitysolutions.com";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase request failed (${res.status}): ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function ensureCustomer(metadata) {
  const email = (metadata.email || "").trim();
  if (!email) return null;

  const existing = await supabaseRequest(`customers?select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
  if (existing.length) return existing[0].id;

  const inserted = await supabaseRequest("customers", {
    method: "POST",
    body: {
      business_name: metadata.customerName || "Customer",
      contact_person: metadata.customerName || "Customer",
      phone: metadata.customerPhone || null,
      email,
      password: email,
      address: metadata.pickup || null,
      billing_address: metadata.pickup || null,
      account_status: "Active",
    },
  });

  return inserted.length ? inserted[0].id : null;
}

async function sendConfirmationEmail({ toEmail, customerName, trackingNumber, amount, pickup, dropoff, pickupDate }) {
  if (!RESEND_API_KEY || !toEmail) return;

  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [toEmail],
      subject: `Payment received - Tracking ${trackingNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0b2d52;max-width:640px;margin:0 auto;">
          <h2 style="margin-bottom:8px;">C&A Quality Solutions LLC</h2>
          <p>Hi ${customerName || "Customer"},</p>
          <p>Your payment was received successfully and your booking is now in dispatch review.</p>
          <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
          <p><strong>Amount Paid:</strong> $${Number(amount || 0).toFixed(2)}</p>
          <p><strong>Pickup:</strong> ${pickup || "N/A"}</p>
          <p><strong>Drop-off:</strong> ${dropoff || "N/A"}</p>
          <p><strong>Requested Date:</strong> ${pickupDate || "N/A"}</p>
          <p>You can track your shipment at <a href="https://caqualitysolutions.com/customer/tracking.html">caqualitysolutions.com/customer/tracking.html</a>.</p>
          <p>Thank you for choosing C&A Quality Solutions LLC.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Confirmation email send failed:", error.message || error);
  }
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    if (!WEBHOOK_SECRET) {
      return json(500, { error: "Missing STRIPE_WEBHOOK_SECRET" });
    }

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "";

    const signature =
      event.headers["stripe-signature"] ||
      event.headers["Stripe-Signature"] ||
      "";

    const stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

    if (stripeEvent.type !== "checkout.session.completed") {
      return json(200, { received: true, ignored: stripeEvent.type });
    }

    const session = stripeEvent.data.object;
    const metadata = session.metadata || {};
    const stripeSessionId = String(session.id || "");

    if (!stripeSessionId) {
      return json(400, { error: "Missing Stripe session id" });
    }

    const existingDelivery = await supabaseRequest(
      `deliveries?select=id&stripe_session_id=eq.${encodeURIComponent(stripeSessionId)}&limit=1`
    );

    if (existingDelivery.length) {
      return json(200, { received: true, duplicate: true, delivery_id: existingDelivery[0].id });
    }

    const amountTotal = Number(session.amount_total || 0) / 100;
    const customerId = metadata.customerId || (await ensureCustomer(metadata));

    const deliveryPayload = {
      customer_id: customerId || null,
      tracking_number: metadata.trackingNumber || `CAQ-${Date.now()}`,
      customer_name: metadata.customerName || "Customer",
      customer_email: metadata.email || session.customer_email || null,
      customer_phone: metadata.customerPhone || null,
      pickup_address: metadata.pickup || null,
      pickup_location: metadata.pickup || null,
      delivery_address: metadata.dropoff || null,
      delivery_location: metadata.dropoff || null,
      destination_address: metadata.dropoff || null,
      package_type: metadata.serviceType || "Standard Courier",
      estimated_distance_miles: Number(metadata.estimatedMiles || 0),
      estimated_price: Number(metadata.amount || amountTotal || 0),
      amount: Number(metadata.amount || amountTotal || 0),
      total_amount: Number(metadata.amount || amountTotal || 0),
      delivery_fee: Number(metadata.amount || amountTotal || 0),
      delivery_date: metadata.pickupDate || null,
      notes: metadata.instructions || null,
      status: "Pending",
      assignment_status: "Unassigned",
      payment_status: "Paid",
      booking_status: "Pending Dispatch",
      stripe_session_id: stripeSessionId,
      checkout_session_id: stripeSessionId,
      source: "stripe_checkout",
    };

    const inserted = await supabaseRequest("deliveries", {
      method: "POST",
      body: deliveryPayload,
    });

    await sendConfirmationEmail({
      toEmail: metadata.email || session.customer_email || null,
      customerName: metadata.customerName || "Customer",
      trackingNumber: deliveryPayload.tracking_number,
      amount: deliveryPayload.total_amount,
      pickup: deliveryPayload.pickup_location,
      dropoff: deliveryPayload.delivery_location,
      pickupDate: deliveryPayload.delivery_date,
    });

    return json(200, { received: true, delivery_id: inserted[0] ? inserted[0].id : null });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
