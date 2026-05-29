const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const { amount } = JSON.parse(event.body);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "C&A Quality Solutions Booking"
          },
          unit_amount: Math.round(amount * 100)
        },
        quantity: 1
      }
    ],
    mode: "payment",
    success_url: "https://c-a-quality-solutions-2555a.netlify.app/success.html",
cancel_url: "https://c-a-quality-solutions-2555a.netlify.app/booking.html"
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url })
  };
};