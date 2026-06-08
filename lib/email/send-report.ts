import { Resend } from "resend";
import {
  buildMonthlyReportHtml,
  monthlyReportSubject,
  type MonthlyReportData,
} from "@/lib/email/monthly-report-template";
import {
  buildRestaurantReportContext,
  fetchAllRestaurantIds,
  logEmailSend,
} from "@/lib/email/report-data";

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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      restaurantId,
      restaurantName: context.report.restaurantName,
      success: false,
      email: context.ownerEmail,
      error: "RESEND_API_KEY not configured",
      report: context.report,
    };
  }

  const html = buildMonthlyReportHtml(context.report);
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || "reports@digivoceeats.com";

  const { data, error: sendError } = await resend.emails.send({
    from: `DigiVoceEats Reports <${from}>`,
    to: context.ownerEmail,
    subject: monthlyReportSubject(context.report),
    html,
  });

  if (sendError) {
    await logEmailSend({
      restaurantId,
      recipientEmail: context.ownerEmail,
      reportMonth: month,
      reportYear: year,
      status: "failed",
      errorMessage: sendError.message,
      report: context.report,
    });
    return {
      restaurantId,
      restaurantName: context.report.restaurantName,
      success: false,
      email: context.ownerEmail,
      error: sendError.message,
      report: context.report,
    };
  }

  await logEmailSend({
    restaurantId,
    recipientEmail: context.ownerEmail,
    reportMonth: month,
    reportYear: year,
    status: "sent",
    resendId: data?.id,
    report: context.report,
  });

  return {
    restaurantId,
    restaurantName: context.report.restaurantName,
    success: true,
    email: context.ownerEmail,
    report: context.report,
    resendId: data?.id,
  };
}

export async function sendMonthlyReportsForAll(year: number, month: number) {
  const ids = await fetchAllRestaurantIds();
  const results: SendReportResult[] = [];
  for (const id of ids) {
    results.push(await sendMonthlyReportForRestaurant(id, year, month));
  }
  return results;
}
