import { Resend } from "resend";
import {
  generateMonthlyReportHtml,
  type MonthlyReportData,
} from "@/lib/email/monthly-report-template";
import {
  buildRestaurantReportContext,
  fetchAllRestaurantIds,
  logEmailSend,
} from "@/lib/email/report-data";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMonthlyReportEmail(
  toEmail: string,
  data: MonthlyReportData,
): Promise<{ id: string }> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const subject = `📊 ${data.restaurantName} — Monthly Report (${data.month})`;
  const html = generateMonthlyReportHtml(data);

  const { data: result, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "reports@digivoceeats.com",
    to: [toEmail],
    bcc: [process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "diginetplore@gmail.com"],
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);

  return { id: result!.id };
}

export type SendReportResult = {
  restaurantId: string;
  restaurantName: string;
  success: boolean;
  email?: string;
  error?: string;
  report?: MonthlyReportData;
  resendId?: string;
};

export async function sendMonthlyReportForRestaurant(
  restaurantId: string,
  year: number,
  month: number,
): Promise<SendReportResult> {
  const context = await buildRestaurantReportContext(restaurantId, year, month);

  if ("error" in context) {
    const result: SendReportResult = {
      restaurantId,
      restaurantName: context.restaurantName || "Unknown",
      success: false,
      error: context.error,
    };
    if (context.restaurantName) {
      await logEmailSend({
        restaurantId,
        recipientEmail: "unknown",
        reportMonth: month,
        reportYear: year,
        status: "failed",
        errorMessage: context.error,
      });
    }
    return result;
  }

  try {
    const { id } = await sendMonthlyReportEmail(context.ownerEmail, context.report);

    await logEmailSend({
      restaurantId,
      recipientEmail: context.ownerEmail,
      reportMonth: month,
      reportYear: year,
      status: "sent",
      resendId: id,
      report: context.report,
    });

    return {
      restaurantId,
      restaurantName: context.report.restaurantName,
      success: true,
      email: context.ownerEmail,
      report: context.report,
      resendId: id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    await logEmailSend({
      restaurantId,
      recipientEmail: context.ownerEmail,
      reportMonth: month,
      reportYear: year,
      status: "failed",
      errorMessage: msg,
      report: context.report,
    });
    return {
      restaurantId,
      restaurantName: context.report.restaurantName,
      success: false,
      email: context.ownerEmail,
      error: msg,
      report: context.report,
    };
  }
}

export async function sendMonthlyReportsForAll(year: number, month: number) {
  const ids = await fetchAllRestaurantIds();
  const results: SendReportResult[] = [];
  for (const id of ids) {
    results.push(await sendMonthlyReportForRestaurant(id, year, month));
  }
  return results;
}
