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
