import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendMonthlyReportForRestaurant,
  sendMonthlyReportsForAll,
} from "@/lib/monthly-report-email";

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

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isAdmin && !isCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const year = parseInt(String(body.year || now.getFullYear()), 10);
    const month = parseInt(String(body.month || now.getMonth() + 1), 10);
    const restaurantId = body.restaurantId as string | undefined;

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    if (restaurantId) {
      const result = await sendMonthlyReportForRestaurant(restaurantId, year, month);
      return NextResponse.json({
        success: result.success,
        result,
      });
    }

    const results = await sendMonthlyReportsForAll(year, month);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failed === 0,
      summary: { total: results.length, succeeded, failed },
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Send report failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
