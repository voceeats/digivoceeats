import { Resend } from "resend";
import {
  computeMonthlyReportMetrics,
  monthLabel,
  monthRangeIso,
  type MonthlyEmailOrder,
  type MonthlyReportMetrics,
} from "@/lib/monthly-report";
import { supabaseAdmin } from "@/lib/supabase";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/dashboard`
  : "https://www.digivoceeats.com/dashboard";

const LOGO_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/digivoceeats_logo.png`
  : "https://www.digivoceeats.com/digivoceeats_logo.png";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function buildMonthlyReportHtml(params: {
  ownerName: string;
  restaurantName: string;
  year: number;
  month: number;
  metrics: MonthlyReportMetrics;
}) {
  const { ownerName, restaurantName, year, month, metrics } = params;
  const period = monthLabel(year, month);

  const topItemsHtml =
    metrics.top_5_items.length === 0
      ? "<li style=\"color:#6B7280;\">No paid orders this month</li>"
      : metrics.top_5_items
          .map(
            (item, i) =>
              `<li style="margin-bottom:8px;color:#374151;"><strong style="color:#FF6B35;">${i + 1}.</strong> ${item.name} <span style="color:#6B7280;">(${item.count} ordered)</span></li>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0A0A0F;padding:28px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="DigiVoceEats" height="48" style="height:48px;width:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="color:#374151;font-size:16px;margin:0 0 8px;">Hi ${ownerName},</p>
            <h1 style="color:#111827;font-size:22px;font-weight:800;margin:0 0 24px;">Your ${period} Report</h1>
            <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Here's how <strong>${restaurantName}</strong> performed on DigiVoceEats last month.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F3;border:1px solid #FFD4C2;border-radius:12px;margin-bottom:28px;">
              <tr><td style="padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%" style="padding:8px 0;">
                      <div style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Orders</div>
                      <div style="color:#111827;font-size:28px;font-weight:900;">${metrics.total_orders}</div>
                    </td>
                    <td width="50%" style="padding:8px 0;">
                      <div style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Revenue</div>
                      <div style="color:#111827;font-size:28px;font-weight:900;">${money(metrics.total_revenue)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding:8px 0;">
                      <div style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Payout (85%)</div>
                      <div style="color:#00A67E;font-size:24px;font-weight:900;">${money(metrics.restaurant_payout)}</div>
                    </td>
                    <td width="50%" style="padding:8px 0;">
                      <div style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">DigiVoceEats Fee (15%)</div>
                      <div style="color:#FF6B35;font-size:24px;font-weight:900;">${money(metrics.platform_fee)}</div>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <h2 style="color:#111827;font-size:16px;font-weight:800;margin:0 0 12px;">🍽️ Top 5 Items Ordered</h2>
            <ul style="margin:0 0 24px;padding-left:20px;">${topItemsHtml}</ul>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="50%" style="padding-right:8px;">
                  <div style="background:#F9FAFB;border-radius:10px;padding:16px;border:1px solid #E5E7EB;">
                    <div style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;">Busiest Day</div>
                    <div style="color:#111827;font-size:18px;font-weight:800;margin-top:4px;">${metrics.busiest_day.label}</div>
                    <div style="color:#6B7280;font-size:13px;">${metrics.busiest_day.count} orders</div>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px;">
                  <div style="background:#F9FAFB;border-radius:10px;padding:16px;border:1px solid #E5E7EB;">
                    <div style="color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;">Busiest Hour</div>
                    <div style="color:#111827;font-size:18px;font-weight:800;margin-top:4px;">${metrics.busiest_hour.label}</div>
                    <div style="color:#6B7280;font-size:13px;">${metrics.busiest_hour.count} orders</div>
                  </div>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0"><tr><td>
              <a href="${DASHBOARD_URL}" style="display:inline-block;background:#FF6B35;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">View Full Report →</a>
            </td></tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#0A0A0F;padding:20px 32px;text-align:center;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">Powered by <strong style="color:#FF6B35;">DigiVoceEats</strong> · Diginetplore</p>
            <p style="color:#6B7280;font-size:11px;margin:8px 0 0;">Voice AI ordering for restaurants</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function resolveOwnerEmail(restaurant: {
  email?: string | null;
  owner_id?: string | null;
}) {
  if (restaurant.email) return restaurant.email;

  if (restaurant.owner_id) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(restaurant.owner_id);
    if (userData.user?.email) return userData.user.email;
  }

  return null;
}

async function resolveOwnerName(restaurant: {
  name: string;
  owner_id?: string | null;
}) {
  if (restaurant.owner_id) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(restaurant.owner_id);
    const meta = userData.user?.user_metadata as { full_name?: string; name?: string } | undefined;
    if (meta?.full_name) return meta.full_name;
    if (meta?.name) return meta.name;
    if (userData.user?.email) return userData.user.email.split("@")[0];
  }
  return restaurant.name;
}

export async function fetchPaidOrdersForMonth(restaurantId: string, year: number, month: number) {
  const { start, end } = monthRangeIso(year, month);
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("payment_status", "paid")
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) throw new Error(error.message);
  return (data || []) as MonthlyEmailOrder[];
}

export type SendReportResult = {
  restaurantId: string;
  restaurantName: string;
  success: boolean;
  email?: string;
  error?: string;
  metrics?: MonthlyReportMetrics;
};

export async function sendMonthlyReportForRestaurant(
  restaurantId: string,
  year: number,
  month: number,
): Promise<SendReportResult> {
  const { data: restaurant, error: restError } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, email, owner_id")
    .eq("id", restaurantId)
    .single();

  if (restError || !restaurant) {
    return {
      restaurantId,
      restaurantName: "Unknown",
      success: false,
      error: restError?.message || "Restaurant not found",
    };
  }

  const recipientEmail = await resolveOwnerEmail(restaurant);
  if (!recipientEmail) {
    return {
      restaurantId,
      restaurantName: restaurant.name,
      success: false,
      error: "No owner email found",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      restaurantId,
      restaurantName: restaurant.name,
      success: false,
      error: "RESEND_API_KEY not configured",
    };
  }

  const orders = await fetchPaidOrdersForMonth(restaurantId, year, month);
  const metrics = computeMonthlyReportMetrics(orders);
  const ownerName = await resolveOwnerName(restaurant);
  const period = monthLabel(year, month);
  const html = buildMonthlyReportHtml({
    ownerName,
    restaurantName: restaurant.name,
    year,
    month,
    metrics,
  });

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || "reports@digivoceeats.com";

  const { error: sendError } = await resend.emails.send({
    from: `DigiVoceEats Reports <${from}>`,
    to: recipientEmail,
    subject: `Your DigiVoceEats Report — ${period}`,
    html,
  });

  if (sendError) {
    return {
      restaurantId,
      restaurantName: restaurant.name,
      success: false,
      email: recipientEmail,
      error: sendError.message,
    };
  }

  return {
    restaurantId,
    restaurantName: restaurant.name,
    success: true,
    email: recipientEmail,
    metrics,
  };
}

export async function sendMonthlyReportsForAll(year: number, month: number) {
  const { data: restaurants, error } = await supabaseAdmin.from("restaurants").select("id");
  if (error) throw new Error(error.message);

  const results: SendReportResult[] = [];
  for (const rest of restaurants || []) {
    results.push(await sendMonthlyReportForRestaurant(rest.id, year, month));
  }
  return results;
}
