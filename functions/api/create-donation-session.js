import Stripe from 'stripe';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function sanitizeString(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function toUnitAmount(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function getAllowedOrigin(requestUrl) {
  const url = new URL(requestUrl);
  return url.origin;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Missing STRIPE_SECRET_KEY environment variable.' }, 500);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload.' }, 400);
  }

  const amount = toUnitAmount(body.amount);
  const frequency = body.frequency === 'monthly' ? 'monthly' : 'one_time';
  const name = sanitizeString(body.name, 120);
  const email = sanitizeString(body.email, 200);
  const message = sanitizeString(body.message, 500);
  const anonymous = Boolean(body.anonymous);

  if (!amount || amount < 100) {
    return json({ error: 'Minimum donation is $1.00.' }, 400);
  }

  if (amount > 99999999) {
    return json({ error: 'Donation amount is too large.' }, 400);
  }

  if (!email) {
    return json({ error: 'Email address is required.' }, 400);
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient()
    });

    const origin = getAllowedOrigin(request.url);

    const commonParams = {
      billing_address_collection: 'auto',
      customer_email: email,
        success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?donation=cancelled`,
      metadata: {
        donor_name: name || 'Anonymous donor',
        donor_email: email,
        donor_message: message,
        anonymous: String(anonymous),
        donation_frequency: frequency
      }
    };

    let session;

    if (frequency === 'monthly') {
      session = await stripe.checkout.sessions.create({
        ...commonParams,
        mode: 'subscription',
        submit_type: 'donate',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              recurring: {
                interval: 'month'
              },
              product_data: {
                name: 'Monthly Donation',
                description: 'Recurring monthly support for Lothel Eddie'
              },
              unit_amount: amount
            },
            quantity: 1
          }
        ]
      });
    } else {
      session = await stripe.checkout.sessions.create({
        ...commonParams,
        mode: 'payment',
        submit_type: 'donate',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'One-Time Donation',
                description: 'One-time gift to support Lothel Eddie'
              },
              unit_amount: amount
            },
            quantity: 1
          }
        ]
      });
    }

    return json({
      url: session.url,
      id: session.id
    });
  } catch (error) {
    return json(
      {
        error: error?.message || 'Unable to create Stripe Checkout Session.'
      },
      500
    );
  }
}