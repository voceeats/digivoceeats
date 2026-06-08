export type MonthlyReportData = {
  restaurantName: string;
  ownerName: string;
  month: string;
  totalOrders: number;
  completedOrders: number;
  rejectedOrders: number;
  totalRevenue: number;
  restaurantEarnings: number;
  platformFee: number;
  avgOrderValue: number;
  topItems: Array<{ name: string; count: number; revenue: number }>;
  peakDay: string;
  peakHour: string;
  payoutMethod: string;
};

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/dashboard`
  : "https://www.digivoceeats.com/dashboard";

const LOGO_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/digivoceeats_logo.png`
  : "https://www.digivoceeats.com/digivoceeats_logo.png";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function monthlyReportSubject(data: MonthlyReportData) {
  return `Your DigiVoceEats Report — ${data.month}`;
}

export function buildMonthlyReportHtml(data: MonthlyReportData) {
  const topItemsHtml =
    data.topItems.length === 0
      ? `<tr><td colspan="2" style="padding:12px 0;color:#6B7280;font-size:14px;">No paid orders this month</td></tr>`
      : data.topItems
          .map(
            (item, i) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
              <span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:#FFF7F3;color:#FF6B35;border-radius:6px;font-weight:800;font-size:12px;margin-right:10px;">${i + 1}</span>
              <span style="color:#111827;font-weight:600;">${item.name}</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:right;color:#6B7280;font-weight:600;">${item.count}× · ${money(item.revenue)}</td>
          </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DigiVoceEats Monthly Report</title>
</head>
<body style="margin:0;padding:0;background:#ECEFF3;font-family:'Segoe UI',system-ui,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEFF3;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0A0A0F 0%,#1a1a2e 100%);padding:36px 32px;border-radius:16px 16px 0 0;text-align:center;">
            <img src="${LOGO_URL}" alt="DigiVoceEats" height="52" style="height:52px;width:auto;margin-bottom:12px;" />
            <div style="color:#FF6B35;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Monthly Performance Report</div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="color:#374151;font-size:16px;margin:0 0 6px;">Hi ${data.ownerName},</p>
            <h1 style="color:#111827;font-size:24px;font-weight:900;margin:0 0 8px;line-height:1.2;">${data.month}</h1>
            <p style="color:#6B7280;font-size:14px;margin:0 0 28px;line-height:1.6;">
              Here's how <strong style="color:#111827;">${data.restaurantName}</strong> performed on DigiVoceEats voice ordering.
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="50%" style="padding:4px;">
                  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;">
                    <div style="color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Total Orders</div>
                    <div style="color:#111827;font-size:32px;font-weight:900;margin-top:4px;">${data.totalOrders}</div>
                    <div style="color:#6B7280;font-size:12px;margin-top:4px;">${data.completedOrders} completed · ${data.rejectedOrders} rejected</div>
                  </div>
                </td>
                <td width="50%" style="padding:4px;">
                  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;">
                    <div style="color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Total Revenue</div>
                    <div style="color:#111827;font-size:32px;font-weight:900;margin-top:4px;">${money(data.totalRevenue)}</div>
                    <div style="color:#6B7280;font-size:12px;margin-top:4px;">Avg ${money(data.avgOrderValue)} / order</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:4px;">
                  <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:20px;">
                    <div style="color:#059669;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Your Payout (85%)</div>
                    <div style="color:#047857;font-size:28px;font-weight:900;margin-top:4px;">${money(data.restaurantEarnings)}</div>
                    <div style="color:#6B7280;font-size:12px;margin-top:4px;">via ${data.payoutMethod}</div>
                  </div>
                </td>
                <td width="50%" style="padding:4px;">
                  <div style="background:#FFF7F3;border:1px solid #FFD4C2;border-radius:12px;padding:20px;">
                    <div style="color:#FF6B35;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">DigiVoceEats Fee (15%)</div>
                    <div style="color:#FF6B35;font-size:28px;font-weight:900;margin-top:4px;">${money(data.platformFee)}</div>
                  </div>
                </td>
              </tr>
            </table>

            <h2 style="color:#111827;font-size:15px;font-weight:800;margin:0 0 12px;">🍽️ Top 5 Items Ordered</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${topItemsHtml}
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td width="50%" style="padding-right:6px;">
                  <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:18px;">
                    <div style="color:#6366F1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Busiest Day</div>
                    <div style="color:#111827;font-size:20px;font-weight:900;margin-top:6px;">${data.peakDay}</div>
                  </div>
                </td>
                <td width="50%" style="padding-left:6px;">
                  <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:18px;">
                    <div style="color:#6366F1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Busiest Hour</div>
                    <div style="color:#111827;font-size:20px;font-weight:900;margin-top:6px;">${data.peakHour}</div>
                  </div>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="${DASHBOARD_URL}" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF8C5A);color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;padding:16px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(255,107,53,0.35);">
                  View Full Report →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#0A0A0F;padding:24px 32px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">
              Powered by <strong style="color:#FF6B35;">DigiVoceEats</strong> · A Diginetplore product
            </p>
            <p style="color:#4B5563;font-size:11px;margin:8px 0 0;">Voice AI phone ordering for restaurants</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
