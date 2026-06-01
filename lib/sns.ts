import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

function getSnsClient() {
  return new SNSClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function buildPaymentLinkBody({
  restaurantName,
  orderNumber,
  total,
  paymentUrl,
  expiryMinutes = 30,
}: {
  restaurantName: string;
  orderNumber: string;
  total: number;
  paymentUrl: string;
  expiryMinutes?: number;
}) {
  return `🍽️ ${restaurantName}

Order ${orderNumber}
Total: $${total.toFixed(2)}

Pay securely here:
${paymentUrl}

⏱️ Link expires in ${expiryMinutes} minutes
✅ Accepts Apple Pay & Google Pay

Reply STOP to opt out.`;
}

export async function sendPaymentLink({
  to,
  restaurantName,
  orderNumber,
  total,
  paymentUrl,
  expiryMinutes = 30,
}: {
  to: string;
  restaurantName: string;
  orderNumber: string;
  total: number;
  paymentUrl: string;
  expiryMinutes?: number;
}) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS SNS credentials missing in environment");
  }

  const originationNumber = process.env.AWS_SNS_ORIGINATION_NUMBER;
  if (!originationNumber) {
    throw new Error("AWS_SNS_ORIGINATION_NUMBER missing in environment");
  }

  const client = getSnsClient();
  const body = buildPaymentLinkBody({
    restaurantName,
    orderNumber,
    total,
    paymentUrl,
    expiryMinutes,
  });

  const result = await client.send(
    new PublishCommand({
      PhoneNumber: to,
      Message: body,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
        "AWS.MM.SMS.OriginationNumber": {
          DataType: "String",
          StringValue: originationNumber,
        },
      },
    }),
  );

  if (!result.MessageId) {
    throw new Error("SNS publish did not return a MessageId");
  }

  return result.MessageId;
}

export async function sendSms({ to, body }: { to: string; body: string }) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS SNS credentials missing in environment");
  }

  const originationNumber = process.env.AWS_SNS_ORIGINATION_NUMBER;
  if (!originationNumber) {
    throw new Error("AWS_SNS_ORIGINATION_NUMBER missing in environment");
  }

  const client = getSnsClient();
  const result = await client.send(
    new PublishCommand({
      PhoneNumber: to,
      Message: body,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
        "AWS.MM.SMS.OriginationNumber": {
          DataType: "String",
          StringValue: originationNumber,
        },
      },
    }),
  );

  if (!result.MessageId) {
    throw new Error("SNS publish did not return a MessageId");
  }

  return result.MessageId;
}
