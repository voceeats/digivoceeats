import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = process.env.TWILIO_PHONE_NUMBER!;

export async function sendPaymentLink({
  to, restaurantName, orderNumber, total, paymentUrl, expiryMinutes = 30,
}: {
  to: string; restaurantName: string; orderNumber: string;
  total: number; paymentUrl: string; expiryMinutes?: number;
}) {
  const body = `🍽️ ${restaurantName}

Order ${orderNumber}
Total: $${total.toFixed(2)}

Pay securely here:
${paymentUrl}

⏱️ Link expires in ${expiryMinutes} minutes
✅ Accepts Apple Pay & Google Pay

Reply STOP to opt out.`;

  return sendRawSms(to, body);
}

export async function sendRawSms(to: string, body: string) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio credentials missing in environment");
  }

  const message = await client.messages.create({
    from: FROM,
    to,
    body,
  });
  return message.sid;
}

export async function sendOrderConfirmation({
  to, restaurantName, orderNumber, items, total, prepTime = 20,
}: {
  to: string; restaurantName: string; orderNumber: string;
  items: Array<{ name: string; qty: number }>; total: number; prepTime?: number;
}) {
  const itemsList = items.map((i) => `  ${i.qty}x ${i.name}`).join("\n");
  const message = await client.messages.create({
    from: FROM,
    to,
    body: `✅ Order Confirmed!

${restaurantName}
Order: ${orderNumber}

${itemsList}

Total: $${total.toFixed(2)}
⏱️ Ready in ~${prepTime} minutes

Thank you for your order!`,
  });
  return message.sid;
}

export async function sendOrderRejected({
  to, restaurantName, orderNumber, reason,
}: {
  to: string; restaurantName: string; orderNumber: string; reason?: string;
}) {
  const message = await client.messages.create({
    from: FROM,
    to,
    body: `❌ Order Update

${restaurantName}
Order ${orderNumber} could not be accepted.
${reason ? `Reason: ${reason}` : "Please call us directly or try again."}

We apologize for the inconvenience.`,
  });
  return message.sid;
}

export async function sendIVRPaymentConfirmation({
  to, restaurantName, orderNumber, total, last4,
}: {
  to: string; restaurantName: string; orderNumber: string;
  total: number; last4: string;
}) {
  const message = await client.messages.create({
    from: FROM,
    to,
    body: `💳 Payment Received

${restaurantName}
Order: ${orderNumber}
Amount: $${total.toFixed(2)}
Card: ****${last4}

Your order is being prepared!`,
  });
  return message.sid;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}
