const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

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

const bookingHtml = `
  <h2>C&A Quality Solutions Booking Confirmation</h2>

  <p><strong>Customer:</strong> ${customerName}</p>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Service:</strong> ${serviceType}</p>
  <p><strong>Pickup Address:</strong> ${pickup}</p>
  <p><strong>Drop-off Address:</strong> ${dropoff}</p>
  <p><strong>Pickup Date:</strong> ${pickupDate}</p>
  <p><strong>Pickup Time:</strong> ${pickupTime}</p>
  <p><strong>Amount:</strong> $${amount}</p>

  <hr>

  <p>Thank you for choosing C&A Quality Solutions LLC.</p>
  <p>Phone: 410-878-5949</p>
  <p>Email: james@caqualitysolutions.com</p>
`;

try {
  await resend.emails.send({
    from: "C&A Quality Solutions <bookings@caqualitysolutions.com>",
    to: email,
    subject: "Your C&A Quality Solutions Booking Confirmation",
    html: bookingHtml,
  });

  await resend.emails.send({
    from: "C&A Quality Solutions <bookings@caqualitysolutions.com>",
    to: "james@caqualitysolutions.com",
    subject: "New Booking Received - C&A Quality Solutions",
    html: bookingHtml,
  });

  await resend.emails.send({
    from: "C&A Quality Solutions <bookings@caqualitysolutions.com>",
    to: "alexisbright@caqualitysolutions.com",
    subject: "New Booking Received - C&A Quality Solutions",
    html: bookingHtml,
  });
} catch (emailError) {
  console.error("Email sending failed:", emailError);
}

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
${pickupTime}`;

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