import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
  appInfo: {
    name: "VoceEats",
    version: "1.0.0",
    url: "https://voiceeats.com",
  },
});

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 15) / 100;
const PAYMENT_LINK_EXPIRY = Number(process.env.PAYMENT_LINK_EXPIRY_MINUTES || 30);

export function calculateSplit(subtotal: number, taxRate: number = 0.0875) {
  const tax = parseFloat((subtotal * taxRate).toFixed(2));
  const total = parseFloat((subtotal + tax).toFixed(2));
  const platformFee = parseFloat((subtotal * PLATFORM_FEE_PERCENT).toFixed(2));
  const restaurantPayout = parseFloat((subtotal - platformFee).toFixed(2));
  return { subtotal, tax, total, platformFee, restaurantPayout, platformFeePercent: PLATFORM_FEE_PERCENT * 100 };
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
    })
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
  } as any);

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
  } as any);

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

export function constructWebhookEvent(payload: string, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
}
