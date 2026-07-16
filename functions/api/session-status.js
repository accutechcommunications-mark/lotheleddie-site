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

function formatAmount(amountTotal, currency = 'usd') {
  if (typeof amountTotal !== 'number') return null;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amountTotal / 100);
  } catch {
    return `${(amountTotal / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Missing STRIPE_SECRET_KEY environment variable.' }, 500);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return json({ error: 'Missing session_id.' }, 400);
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient()
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return json({
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email || '',
      amountTotal: session.amount_total,
      amountFormatted: formatAmount(session.amount_total, session.currency),
      currency: session.currency,
      mode: session.mode
    });
  } catch (error) {
    return json(
      {
        error: error?.message || 'Unable to retrieve Stripe Checkout Session.'
      },
      500
    );
  }
}