const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const amount = Number(body.amount);
    const email = body.email;
    const customerName = body.customerName;
    const pickup = body.pickup;
    const dropoff = body.dropoff;
    const serviceType = body.serviceType;
    const pickupDate = body.pickupDate;
    const pickupTime = body.pickupTime;

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid amount" }),
      };
    }

    const details =
      `Customer: ${customerName || "Not provided"}\n` +
      `Service: ${serviceType || "Not provided"}\n` +
      `Pickup: ${pickup || "Not provided"}\n` +
      `Drop-off: ${dropoff || "Not provided"}\n` +
      `Date: ${pickupDate || "Not provided"}\n` +
      `Time: ${pickupTime || "Not provided"}`;

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
        customerName,
        serviceType,
        pickup,
        dropoff,
        pickupDate,
        pickupTime,
      },
      success_url: "https://caqualitysolutions.com/success.html",
      cancel_url: "https://caqualitysolutions.com/cancel.html",
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