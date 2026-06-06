import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
  appInfo: {
    name: "DigiVoceEats by Diginetplore",
    version: "1.0.0",
    url: "https://www.digivoceeats.com",
  },
});

/** Decimal platform fee rate (e.g. 0.15). Override with PLATFORM_FEE_PERCENT env (whole percent). */
export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 15) / 100;

const PAYMENT_LINK_EXPIRY = Number(process.env.PAYMENT_LINK_EXPIRY_MINUTES || 30);

export function calculateSplit(subtotal: number, taxRate: number = 0.0875) {
  const tax = parseFloat((subtotal * taxRate).toFixed(2));
  const total = parseFloat((subtotal + tax).toFixed(2));
  const platformFee = parseFloat((subtotal * PLATFORM_FEE_PERCENT).toFixed(2));
  const restaurantPayout = parseFloat((subtotal - platformFee).toFixed(2));
  return { subtotal, tax, total, platformFee, restaurantPayout, platformFeePercent: PLATFORM_FEE_PERCENT * 100 };
}

// Create Stripe Connect Express account for restaurant
export async function createRestaurantAccount(
  restaurantId: string,
  email: string,
  restaurantName: string,
) {
  const account = await stripe.accounts.create({
    type: "express",
    email,
    business_profile: {
      name: restaurantName,
      mcc: "5812", // Restaurants
      url: "https://www.digivoceeats.com",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      restaurant_id: restaurantId,
      platform: "voceeats",
    },
    settings: {
      payouts: {
        schedule: { interval: "daily" },
      },
    },
  });
  return account;
}

// Get onboarding link for restaurant (dashboard Stripe flow)
export async function getOnboardingLink(stripeAccountId: string, restaurantId: string) {
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/stripe/refresh?restaurantId=${restaurantId}`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/stripe/complete?restaurantId=${restaurantId}`,
    type: "account_onboarding",
  });
  return accountLink.url;
}

// Check if restaurant Stripe account is fully set up
export async function getAccountStatus(stripeAccountId: string) {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  return {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    requirements: account.requirements,
  };
}

// Create payment intent with automatic platform fee split (fee on total charged)
export async function createPaymentIntent(
  amount: number, // total amount customer pays in dollars
  restaurantStripeAccountId: string,
  orderId: string,
  orderNumber: string,
  restaurantName: string,
  customerEmail?: string,
) {
  const amountInCents = Math.round(amount * 100);
  const platformFeeInCents = Math.round(amount * PLATFORM_FEE_PERCENT * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    application_fee_amount: platformFeeInCents,
    transfer_data: {
      destination: restaurantStripeAccountId,
    },
    receipt_email: customerEmail || undefined,
    metadata: {
      order_id: orderId,
      order_number: orderNumber,
      restaurant_name: restaurantName,
      platform: "voceeats",
    },
    automatic_payment_methods: { enabled: true },
    description: `DigiVoceEats Order ${orderNumber} at ${restaurantName}`,
  });

  return paymentIntent;
}

// Create Stripe Checkout Session — direct charge to the platform's main
// Stripe account (no Connect transfer/on_behalf_of). Restaurants do not need
// to have completed Stripe onboarding for this to work.
export async function createCheckoutSession(
  order: {
    id: string;
    order_number: string;
    items: Array<{ name: string; price: number; qty: number }>;
    subtotal: number;
    tax: number;
    total: number;
    platform_fee: number;
    restaurant_payout: number;
    customer_phone?: string;
    customer_name?: string;
  },
  restaurantName: string,
  customerEmail?: string,
  successUrl?: string,
  cancelUrl?: string,
) {
  const lineItems = order.items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.name,
        description: `Order from ${restaurantName}`,
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.qty,
  }));

  if (order.tax > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Tax (6%)",
          description: "Northern Virginia sales tax",
        },
        unit_amount: Math.round(order.tax * 100),
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/order-confirmed/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pay/${order.id}?cancelled=true`,
    customer_email: customerEmail || undefined,
    payment_intent_data: {
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        restaurant_name: restaurantName,
        platform: "voceeats",
      },
      receipt_email: customerEmail || undefined,
    },
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      customer_phone: order.customer_phone || "",
      customer_name: order.customer_name || "",
    },
    phone_number_collection: { enabled: false },
    expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
  } as Stripe.Checkout.SessionCreateParams);

  return session;
}

export async function createSMSPaymentLink({
  orderId, orderNumber, restaurantName, restaurantStripeAccountId, items, total, platformFee,
}: {
  orderId: string; orderNumber: string; restaurantName: string;
  restaurantStripeAccountId: string;
  items: Array<{ name: string; price: number; qty: number }>;
  total: number; platformFee: number;
}) {
  const expiresAt = Math.floor(Date.now() / 1000) + PAYMENT_LINK_EXPIRY * 60;

  const lineItems = await Promise.all(
    items.map(async (item) => {
      const product = await stripe.products.create({
        name: item.name,
        metadata: { order_id: orderId },
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(item.price * 100),
        currency: "usd",
      });
      return { price: price.id, quantity: item.qty };
    }),
  );

  const paymentLink = await stripe.paymentLinks.create({
    line_items: lineItems,
    application_fee_amount: Math.round(platformFee * 100),
    transfer_data: { destination: restaurantStripeAccountId },
    after_completion: {
      type: "redirect",
      redirect: { url: `${process.env.NEXT_PUBLIC_APP_URL}/order-confirmed/${orderId}` },
    },
    metadata: { order_id: orderId, order_number: orderNumber, restaurant_name: restaurantName },
    payment_method_types: ["card"],
  } as Stripe.PaymentLinkCreateParams);

  return {
    paymentLinkId: paymentLink.id,
    paymentLinkUrl: paymentLink.url,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export async function chargeIVRCard({
  cardNumber, expMonth, expYear, cvc, amount, restaurantStripeAccountId, platformFee, metadata,
}: {
  cardNumber: string; expMonth: number; expYear: number; cvc: string;
  amount: number; restaurantStripeAccountId: string;
  platformFee: number; metadata: Record<string, string>;
}) {
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: { number: cardNumber, exp_month: expMonth, exp_year: expYear, cvc },
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "usd",
    payment_method: paymentMethod.id,
    confirm: true,
    application_fee_amount: Math.round(platformFee * 100),
    transfer_data: { destination: restaurantStripeAccountId },
    metadata,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-confirmed/${metadata.order_id}`,
  });

  return paymentIntent;
}

export async function createTapToPayIntent({
  amount, restaurantStripeAccountId, platformFee, metadata,
}: {
  amount: number; restaurantStripeAccountId: string;
  platformFee: number; metadata: Record<string, string>;
}) {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "usd",
    payment_method_types: ["card_present"],
    capture_method: "automatic",
    application_fee_amount: Math.round(platformFee * 100),
    transfer_data: { destination: restaurantStripeAccountId },
    metadata,
  });
}

export async function chargeManualCard({
  paymentMethodId, amount, restaurantStripeAccountId, platformFee, metadata,
}: {
  paymentMethodId: string; amount: number; restaurantStripeAccountId: string;
  platformFee: number; metadata: Record<string, string>;
}) {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "usd",
    payment_method: paymentMethodId,
    confirm: true,
    application_fee_amount: Math.round(platformFee * 100),
    transfer_data: { destination: restaurantStripeAccountId },
    metadata,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-confirmed/${metadata.order_id}`,
  });
}

export async function createQRPaymentLink({
  orderId, amount, restaurantStripeAccountId, platformFee, metadata,
}: {
  orderId: string; amount: number; restaurantStripeAccountId: string;
  platformFee: number; metadata: Record<string, string>;
}) {
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `Order ${metadata.order_number}` },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    application_fee_amount: Math.round(platformFee * 100),
    transfer_data: { destination: restaurantStripeAccountId },
    after_completion: {
      type: "redirect",
      redirect: { url: `${process.env.NEXT_PUBLIC_APP_URL}/order-confirmed/${orderId}` },
    },
    metadata,
  } as Stripe.PaymentLinkCreateParams);

  return { url: paymentLink.id, qrUrl: paymentLink.url };
}

export async function createConnectAccount(restaurantId: string, email: string) {
  return await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { restaurant_id: restaurantId },
    business_type: "individual",
    settings: { payouts: { schedule: { interval: "daily" } } },
  });
}

export async function createConnectOnboardingLink(stripeAccountId: string, restaurantId: string) {
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/stripe/refresh?rid=${restaurantId}`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/stripe/complete?rid=${restaurantId}`,
    type: "account_onboarding",
  });
  return accountLink.url;
}

export function constructWebhookEvent(payload: string | Buffer, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
}
