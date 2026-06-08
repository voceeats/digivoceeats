import { NextRequest, NextResponse } from "next/server";
import { previousCalendarMonth } from "@/lib/monthly-report";
import { sendMonthlyReportsForAll } from "@/lib/monthly-report-email";

export async function GET(request: NextRequest) {
  return runMonthlyCron(request);
}

export async function POST(request: NextRequest) {
  return runMonthlyCron(request);
}

async function runMonthlyCron(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error("monthly-report cron: unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { year, month } = previousCalendarMonth();
    console.log(`📧 monthly-report cron: sending reports for ${month}/${year}`);

    const results = await sendMonthlyReportsForAll(year, month);

    for (const result of results) {
      if (result.success) {
        console.log(`✅ Report sent: ${result.restaurantName} → ${result.email}`);
      } else {
        console.error(`❌ Report failed: ${result.restaurantName} — ${result.error}`);
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failed === 0,
      period: { year, month },
      summary: { total: results.length, succeeded, failed },
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Cron failed";
    console.error("monthly-report cron error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
