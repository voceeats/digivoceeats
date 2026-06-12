import {
  sendPaymentLink as twilioSendPaymentLink,
  sendRawSms as twilioSendRawSms,
  sendOrderConfirmation as twilioSendOrderConfirmation,
  sendIVRPaymentConfirmation as twilioSendIVRPaymentConfirmation,
} from "@/lib/twilio";
import { sendPaymentLink as snsSendPaymentLink, sendSms as snsSendSms } from "@/lib/sns";

async function tryTwilioThenSns(
  twilioFn: () => Promise<unknown>,
  snsFn: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await twilioFn();
    console.log("SMS sent via Twilio");
    return true;
  } catch (twilioError: unknown) {
    const msg = twilioError instanceof Error ? twilioError.message : String(twilioError);
    console.error("Twilio SMS failed, falling back to SNS:", msg);
  }

  try {
    await snsFn();
    console.log("SMS sent via SNS");
    return true;
  } catch (snsError: unknown) {
    const msg = snsError instanceof Error ? snsError.message : String(snsError);
    console.error("SNS SMS failed:", msg);
    return false;
  }
}

export async function sendPaymentLink(params: {
  to: string;
  restaurantName: string;
  orderNumber: string;
  total: number;
  paymentUrl: string;
  expiryMinutes?: number;
}): Promise<boolean> {
  return tryTwilioThenSns(
    () => twilioSendPaymentLink(params),
    () => snsSendPaymentLink(params),
  );
}

export async function sendSmsWithFallback(to: string, body: string): Promise<boolean> {
  return tryTwilioThenSns(
    () => twilioSendRawSms(to, body),
    () => snsSendSms({ to, body }),
  );
}

export async function sendOrderConfirmation(params: {
  to: string;
  restaurantName: string;
  orderNumber: string;
  items: Array<{ name: string; qty: number }>;
  total: number;
  prepTime?: number;
}): Promise<boolean> {
  return tryTwilioThenSns(
    () => twilioSendOrderConfirmation(params),
    () => {
      const itemsList = params.items.map((i) => `  ${i.qty}x ${i.name}`).join("\n");
      const body = `✅ Order Confirmed!

${params.restaurantName}
Order: ${params.orderNumber}

${itemsList}

Total: $${params.total.toFixed(2)}
⏱️ Ready in ~${params.prepTime ?? 20} minutes

Thank you for your order!`;
      return snsSendSms({ to: params.to, body });
    },
  );
}

export async function sendIVRPaymentConfirmation(params: {
  to: string;
  restaurantName: string;
  orderNumber: string;
  total: number;
  last4: string;
}): Promise<boolean> {
  return tryTwilioThenSns(
    () => twilioSendIVRPaymentConfirmation(params),
    () => {
      const body = `💳 Payment Received

${params.restaurantName}
Order: ${params.orderNumber}
Amount: $${params.total.toFixed(2)}
Card: ****${params.last4}

Your order is being prepared!`;
      return snsSendSms({ to: params.to, body });
    },
  );
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.startsWith("+")) return raw;
  return `+1${digits}`;
}

export async function sendDirectPaymentLink(params: {
  to: string;
  restaurantName: string;
  orderNumber: string;
  orderId: string;
  total: number;
}): Promise<boolean> {
  const phone = normalizePhone(params.to);
  const directUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${params.orderId}`;
  const body = `DigiVoceEats: Your ${params.restaurantName} order is confirmed. Pay now: ${directUrl} Total: $${params.total.toFixed(2)}. Reply STOP to opt out.`;

  try {
    await snsSendSms({ to: phone, body });
    console.log(`📱 SMS sent via SNS to ${phone}`);
    return true;
  } catch (err) {
    console.error("SNS SMS failed:", err);
    return false;
  }
}
