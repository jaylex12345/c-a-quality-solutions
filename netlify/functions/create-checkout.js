const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    const amount = Number(body.amount);
    const email = (body.email || "").trim();
    const customerName = (body.customerName || "").trim();
    const customerPhone = (body.customerPhone || "").trim();
    const pickup = (body.pickup || "").trim();
    const dropoff = (body.dropoff || "").trim();
    const serviceType = (body.serviceType || "Standard Courier").trim();
    const pickupDate = (body.pickupDate || "").trim();
    const pickupTime = (body.pickupTime || "").trim();
    const instructions = (body.instructions || "").trim();
    const estimatedMiles = Number(body.estimatedMiles || 0);
    const trackingNumber = (body.trackingNumber || "").trim();
    const customerId = body.customerId ? String(body.customerId) : "";

    if (!email || !customerName || !pickup || !dropoff || !pickupDate || !trackingNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required checkout fields" }),
      };
    }

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid amount" }),
      };
    }

    const details =
`Customer: ${customerName}

Service: ${serviceType}

Pickup:
${pickup}

Drop-off:
${dropoff}

Date:
${pickupDate}

Time:
${pickupTime || "N/A"}`;

  const siteUrl = process.env.SITE_URL || "https://caqualitysolutions.com";

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "C&A Quality Solutions Booking",
              description: details,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        trackingNumber,
        customerId,
        customerName,
        customerPhone,
        email,
        serviceType,
        pickup,
        dropoff,
        pickupDate,
        pickupTime,
        instructions,
        estimatedMiles: Number.isFinite(estimatedMiles) ? String(estimatedMiles) : "0",
        amount: String(amount),
      },
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&tracking=${encodeURIComponent(trackingNumber)}`,
      cancel_url: `${siteUrl}/cancel.html`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};