function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

async function restGet(table, filters) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_2PBI8u5Ja8mptMnFndFgNg_OCdabfqR";
  const search = new URLSearchParams();
  search.set("select", "*");
  filters.forEach(([field, value]) => {
    search.append(field, `eq.${value}`);
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${search.toString()}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Unable to load ${table}`);
  }

  return Array.isArray(payload) ? payload : [];
}

function deriveInvoiceRows(rows, sourceType) {
  return rows
    .filter((row) => row.payment_status || row.status || row.booking_status || row.delivery_time || row.updated_at || row.created_at)
    .map((row) => ({
      id: row.id,
      source_type: sourceType,
      invoice_number: row.invoice_number || row.tracking_number || `INV-${String(row.id || row.tracking_number || row.created_at || "")}`,
      tracking_number: row.tracking_number || "",
      status: row.status || row.payment_status || row.booking_status || "Pending",
      payment_status: row.payment_status || row.status || row.booking_status || "Pending",
      amount: Number(row.amount || row.total_amount || row.delivery_fee || row.cod_amount || 0) || 0,
      created_at: row.created_at || row.updated_at || null,
      receipt_url: row.receipt_url || row.proof_of_delivery || row.proof_photo_url || "",
    }));
}

exports.handler = async function handler(event) {
  try {
    const customerName = String(event.queryStringParameters?.customerName || "").trim();
    const customerEmail = String(event.queryStringParameters?.email || "").trim();
    const customerId = String(event.queryStringParameters?.customerId || "").trim();

    const deliveryFilters = [];
    if (customerEmail) deliveryFilters.push(["customer_email", customerEmail]);
    if (customerName) deliveryFilters.push(["customer_name", customerName]);
    if (customerId) deliveryFilters.push(["customer_id", customerId]);

    const deliverySets = deliveryFilters.length
      ? await Promise.all(deliveryFilters.map(([field, value]) => restGet("deliveries", [[field, value]])))
      : [];

    const deliveries = Array.from(
      new Map(deliverySets.flat().map(row => [String(row.id || `${row.tracking_number || ""}-${row.created_at || ""}`), row])).values()
    );
    const bookings = [];
    const invoices = deriveInvoiceRows(deliveries, "delivery");

    return json(200, {
      customer: {
        id: customerId || null,
        name: customerName || null,
        email: customerEmail || null,
      },
      invoices,
      deliveries,
      bookings,
    });
  } catch (error) {
    return json(500, { error: error.message || "Unable to load portal data" });
  }
};