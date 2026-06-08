import { NextRequest, NextResponse } from "next/server";
import { buildReportData, logEmailSend } from "@/lib/email/report-data";
import { sendMonthlyReportEmail } from "@/lib/email/send-report";
import { supabaseAdmin } from "@/lib/supabase";

type RestaurantRow = {
  id: string;
  name: string;
  email: string | null;
  owner_id: string | null;
};

async function resolveOwnerEmail(restaurant: RestaurantRow): Promise<string | null> {
  if (restaurant.email) return restaurant.email;
  if (restaurant.owner_id) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(restaurant.owner_id);
    if (userData.user?.email) return userData.user.email;
  }
  return null;
}

async function runMonthlyCron(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const period = `${year}-${String(month).padStart(2, "0")}`;

  console.log(`📧 monthly-report cron: sending reports for ${period}`);

  const { data: restaurants, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, email, owner_id");

  if (error) throw new Error(`Fetch restaurants: ${error.message}`);

  const results: Array<{
    restaurantId: string;
    name: string;
    status: "sent" | "failed";
    resendId?: string;
    error?: string;
  }> = [];

  for (const restaurant of (restaurants ?? []) as RestaurantRow[]) {
    const ownerEmail = await resolveOwnerEmail(restaurant);

    if (!ownerEmail) {
      results.push({
        restaurantId: restaurant.id,
        name: restaurant.name,
        status: "failed",
        error: "No owner email found",
      });
      await logEmailSend({
        restaurantId: restaurant.id,
        recipientEmail: "unknown",
        reportMonth: month,
        reportYear: year,
        status: "failed",
        errorMessage: "No owner email found",
      });
      continue;
    }

    try {
      const reportData = await buildReportData(restaurant.id, year, month);
      const { id } = await sendMonthlyReportEmail(ownerEmail, reportData);

      await logEmailSend({
        restaurantId: restaurant.id,
        recipientEmail: ownerEmail,
        reportMonth: month,
        reportYear: year,
        status: "sent",
        resendId: id,
        report: reportData,
      });

      console.log(`✅ Report sent: ${restaurant.name} → ${ownerEmail}`);
      results.push({
        restaurantId: restaurant.id,
        name: restaurant.name,
        status: "sent",
        resendId: id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      console.error(`❌ Report failed: ${restaurant.name} — ${msg}`);
      await logEmailSend({
        restaurantId: restaurant.id,
        recipientEmail: ownerEmail,
        reportMonth: month,
        reportYear: year,
        status: "failed",
        errorMessage: msg,
      });
      results.push({
        restaurantId: restaurant.id,
        name: restaurant.name,
        status: "failed",
        error: msg,
      });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({ success: failed === 0, period, sent, failed, results });
}

export async function GET(req: NextRequest) {
  try {
    return await runMonthlyCron(req);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("monthly-report cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runMonthlyCron(req);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("monthly-report cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
