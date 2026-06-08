export interface MonthlyReportData {
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
  topItems: { name: string; count: number; revenue: number }[];
  peakDay: string;
  peakHour: string;
  payoutMethod: string;
}

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

export function generateMonthlyReportHtml(data: MonthlyReportData): string {
  const {
    restaurantName,
    ownerName,
    month,
    totalOrders,
    completedOrders,
    rejectedOrders,
    totalRevenue,
    restaurantEarnings,
    platformFee,
    avgOrderValue,
    topItems,
    peakDay,
    peakHour,
    payoutMethod,
  } = data;

  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  const topItemsRows =
    topItems.length === 0
      ? `<tr><td colspan="4" style="padding:20px 16px;color:#6b4c2a;font-size:14px;text-align:center;">No paid orders this month</td></tr>`
      : topItems
          .slice(0, 5)
          .map(
            (item, i) => `
    <tr style="border-bottom:1px solid #f0ede8;">
      <td style="padding:12px 16px;color:#b5853a;font-weight:700;font-size:13px;">#${i + 1}</td>
      <td style="padding:12px 16px;color:#2c1a0e;font-size:14px;">${item.name}</td>
      <td style="padding:12px 16px;color:#6b4c2a;font-size:14px;text-align:center;">${item.count} orders</td>
      <td style="padding:12px 16px;color:#2c8a4a;font-size:14px;font-weight:600;text-align:right;">$${item.revenue.toFixed(2)}</td>
    </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Monthly Report — ${month}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a0a00 0%,#3d1f00 60%,#b5853a 100%);border-radius:16px 16px 0 0;padding:48px 40px 36px;text-align:center;">
            <img src="${LOGO_URL}" alt="DigiVoceEats" height="48" style="height:48px;width:auto;margin-bottom:16px;" />
            <p style="margin:0 0 8px;color:#f5e6c8;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">Monthly Performance Report</p>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:normal;letter-spacing:0.5px;">${month}</h1>
            <p style="margin:12px 0 0;color:#d4b896;font-size:15px;">${restaurantName}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px 24px;border-left:1px solid #ede8df;border-right:1px solid #ede8df;">
            <p style="margin:0 0 8px;color:#6b4c2a;font-size:15px;">Dear ${ownerName},</p>
            <p style="margin:0;color:#2c1a0e;font-size:15px;line-height:1.7;">
              Here is your monthly summary for <strong>${restaurantName}</strong> on DigiVoceEats voice ordering.
            </p>
          </td>
        </tr>

        <!-- Summary stats -->
        <tr>
          <td style="background:#ffffff;padding:8px 40px 32px;border-left:1px solid #ede8df;border-right:1px solid #ede8df;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding:6px;">
                  <div style="background:#faf7f2;border:1px solid #ede8df;border-radius:12px;padding:20px;text-align:center;">
                    <div style="color:#6b4c2a;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Total Orders</div>
                    <div style="color:#2c1a0e;font-size:36px;font-weight:bold;margin:6px 0;">${totalOrders}</div>
                    <div style="color:#8a6a4a;font-size:12px;font-family:Arial,sans-serif;">${completedOrders} completed · ${rejectedOrders} rejected</div>
                    <div style="color:#2c8a4a;font-size:12px;margin-top:4px;font-family:Arial,sans-serif;">${completionRate}% completion rate</div>
                  </div>
                </td>
                <td width="50%" style="padding:6px;">
                  <div style="background:#faf7f2;border:1px solid #ede8df;border-radius:12px;padding:20px;text-align:center;">
                    <div style="color:#6b4c2a;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Total Revenue</div>
                    <div style="color:#2c1a0e;font-size:36px;font-weight:bold;margin:6px 0;">${money(totalRevenue)}</div>
                    <div style="color:#8a6a4a;font-size:12px;font-family:Arial,sans-serif;">Avg ${money(avgOrderValue)} per order</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:6px;">
                  <div style="background:#edf7f0;border:1px solid #b8dfc4;border-radius:12px;padding:20px;text-align:center;">
                    <div style="color:#2c8a4a;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Your Payout (85%)</div>
                    <div style="color:#1a6b35;font-size:32px;font-weight:bold;margin:6px 0;">${money(restaurantEarnings)}</div>
                    <div style="color:#6b4c2a;font-size:12px;font-family:Arial,sans-serif;">via ${payoutMethod}</div>
                  </div>
                </td>
                <td width="50%" style="padding:6px;">
                  <div style="background:#fdf6ee;border:1px solid #e8d5b8;border-radius:12px;padding:20px;text-align:center;">
                    <div style="color:#b5853a;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">DigiVoceEats Fee (15%)</div>
                    <div style="color:#8a6020;font-size:32px;font-weight:bold;margin:6px 0;">${money(platformFee)}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Top items -->
        <tr>
          <td style="background:#ffffff;padding:8px 40px 32px;border-left:1px solid #ede8df;border-right:1px solid #ede8df;">
            <h2 style="margin:0 0 16px;color:#2c1a0e;font-size:18px;font-weight:normal;border-bottom:2px solid #b5853a;padding-bottom:8px;display:inline-block;">Top Items Ordered</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ede8df;border-radius:8px;overflow:hidden;">
              <tr style="background:#faf7f2;">
                <th style="padding:10px 16px;color:#6b4c2a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;text-align:left;">Rank</th>
                <th style="padding:10px 16px;color:#6b4c2a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;text-align:left;">Item</th>
                <th style="padding:10px 16px;color:#6b4c2a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;text-align:center;">Orders</th>
                <th style="padding:10px 16px;color:#6b4c2a;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;text-align:right;">Revenue</th>
              </tr>
              ${topItemsRows}
            </table>
          </td>
        </tr>

        <!-- Peak day & hour -->
        <tr>
          <td style="background:#ffffff;padding:8px 40px 36px;border-left:1px solid #ede8df;border-right:1px solid #ede8df;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding:6px;">
                  <div style="background:#faf7f2;border:1px solid #ede8df;border-radius:12px;padding:20px;text-align:center;">
                    <div style="color:#6b4c2a;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Busiest Day</div>
                    <div style="color:#2c1a0e;font-size:22px;font-weight:bold;margin-top:8px;">${peakDay}</div>
                  </div>
                </td>
                <td width="50%" style="padding:6px;">
                  <div style="background:#faf7f2;border:1px solid #ede8df;border-radius:12px;padding:20px;text-align:center;">
                    <div style="color:#6b4c2a;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Busiest Hour</div>
                    <div style="color:#2c1a0e;font-size:22px;font-weight:bold;margin-top:8px;">${peakHour}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:8px 40px 40px;border-left:1px solid #ede8df;border-right:1px solid #ede8df;text-align:center;">
            <a href="${DASHBOARD_URL}" style="display:inline-block;background:linear-gradient(135deg,#b5853a,#d4a853);color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:16px 40px;border-radius:8px;font-family:Arial,sans-serif;letter-spacing:0.5px;">
              View Full Report →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a0a00,#3d1f00);border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
            <p style="margin:0;color:#d4b896;font-size:13px;">
              Powered by <strong style="color:#b5853a;">DigiVoceEats</strong> · Diginetplore
            </p>
            <p style="margin:8px 0 0;color:#6b4c2a;font-size:11px;font-family:Arial,sans-serif;">
              Voice AI phone ordering for restaurants
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** @deprecated Use generateMonthlyReportHtml */
export const buildMonthlyReportHtml = generateMonthlyReportHtml;
