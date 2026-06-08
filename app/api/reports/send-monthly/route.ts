import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildReportData, logEmailSend } from "@/lib/email/report-data";
import { sendMonthlyReportEmail } from "@/lib/email/send-report";
import { supabaseAdmin } from "@/lib/supabase";

const DEFAULT_RESTAURANT_ID = "339ad678-297a-4d57-9f4b-a502650829d3";

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  return !!user && !!adminEmail && user.email === adminEmail;
}

async function resolveOwnerEmail(restaurantId: string): Promise<string | null> {
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("email, owner_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) return null;
  if (restaurant.email) return restaurant.email;

  if (restaurant.owner_id) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(restaurant.owner_id);
    if (userData.user?.email) return userData.user.email;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdmin = !isCron && (await verifyAdmin(req));

    if (!isCron && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const restaurantId: string = body.restaurantId ?? DEFAULT_RESTAURANT_ID;

    const now = new Date();
    const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const year: number = body.year ?? defaultYear;
    const month: number = body.month ?? defaultMonth;

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    let toEmail: string | undefined = body.email;
    if (!toEmail) {
      toEmail = (await resolveOwnerEmail(restaurantId)) ?? undefined;
    }

    if (!toEmail) {
      return NextResponse.json({ error: "No owner email found" }, { status: 400 });
    }

    const reportData = await buildReportData(restaurantId, year, month);
    const { id } = await sendMonthlyReportEmail(toEmail, reportData);

    await logEmailSend({
      restaurantId,
      recipientEmail: toEmail,
      reportMonth: month,
      reportYear: year,
      status: "sent",
      resendId: id,
      report: reportData,
    });

    const period = `${year}-${String(month).padStart(2, "0")}`;

    return NextResponse.json({
      success: true,
      resendId: id,
      recipient: toEmail,
      period,
      report: reportData,
      result: {
        restaurantId,
        restaurantName: reportData.restaurantName,
        success: true,
        email: toEmail,
        resendId: id,
        report: reportData,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
