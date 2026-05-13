import { Order, Restaurant, Printer } from "./supabase";

export function buildReceiptHTML(
  order: Order,
  restaurant: { name: string; address?: string; phone?: string; logo?: string },
  paperWidth: "58mm" | "80mm" = "80mm"
): string {
  const width = paperWidth === "58mm" ? "58mm" : "80mm";
  const fontSize = paperWidth === "58mm" ? "11px" : "12px";

  const itemsHTML = order.items
    .map((item: any) => `
    <div class="row">
      <span>${item.qty}x ${item.name}</span>
      <span>$${(item.price * item.qty).toFixed(2)}</span>
    </div>`
    ).join("");

  const timeStr = new Date(order.created_at).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
  const dateStr = new Date(order.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${order.order_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      width: ${width};
      max-width: ${width};
      padding: 8px;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 16px; }
    .xlarge { font-size: 20px; }
    .small { font-size: 10px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .solid { border-top: 2px solid #000; margin: 6px 0; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 3px 0;
      gap: 4px;
    }
    .row span:first-child { flex: 1; }
    .row span:last-child { white-space: nowrap; }
    @media print {
      body { margin: 0; }
      @page { margin: 0; size: ${width} auto; }
    }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:8px">
    ${restaurant.logo ? `<div style="font-size:28px;margin-bottom:4px">${restaurant.logo}</div>` : ""}
    <div class="bold xlarge">${restaurant.name}</div>
    ${restaurant.address ? `<div class="small">${restaurant.address}</div>` : ""}
    ${restaurant.phone ? `<div class="small">${restaurant.phone}</div>` : ""}
    <div class="small">voiceeats.com</div>
  </div>
  <div class="solid"></div>
  <div class="row"><span class="bold">ORDER #</span><span class="bold">${order.order_number}</span></div>
  <div class="row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="row"><span>Time:</span><span>${timeStr}</span></div>
  <div class="row"><span>Customer:</span><span>${order.customer_name || "Voice Order"}</span></div>
  ${order.customer_phone ? `<div class="row"><span>Phone:</span><span>${order.customer_phone}</span></div>` : ""}
  <div class="row"><span>Source:</span><span>Voice AI</span></div>
  ${order.notes ? `<div class="divider"></div><div class="bold">NOTES:</div><div>${order.notes}</div>` : ""}
  <div class="divider"></div>
  <div class="bold" style="margin-bottom:4px">ITEMS</div>
  ${itemsHTML}
  <div class="divider"></div>
  <div class="row"><span>Subtotal:</span><span>$${order.subtotal.toFixed(2)}</span></div>
  ${order.tax > 0 ? `<div class="row"><span>Tax:</span><span>$${order.tax.toFixed(2)}</span></div>` : ""}
  ${order.tip > 0 ? `<div class="row"><span>Tip:</span><span>$${order.tip.toFixed(2)}</span></div>` : ""}
  <div class="row"><span>Service Fee:</span><span>$${order.platform_fee.toFixed(2)}</span></div>
  <div class="solid"></div>
  <div class="row bold large"><span>TOTAL:</span><span>$${order.total.toFixed(2)}</span></div>
  <div class="solid"></div>
  <div class="center">
    ${order.payment_status === "paid" ? `<div style="border:1px solid #000;padding:2px 6px;display:inline-block;font-size:10px">✅ PAID</div>` :
      order.payment_status === "cash_collected" ? `<div style="border:1px solid #000;padding:2px 6px;display:inline-block;font-size:10px">💵 CASH</div>` :
      `<div style="border:1px solid #000;padding:2px 6px;display:inline-block;font-size:10px">⏳ PAYMENT PENDING</div>`}
  </div>
  <div class="divider"></div>
  <div class="small center">
    <div>Your Payout: $${order.restaurant_payout.toFixed(2)} (85%)</div>
    <div>VoceEats Fee: $${order.platform_fee.toFixed(2)} (15%)</div>
  </div>
  <div class="divider"></div>
  <div class="center small" style="margin-top:10px">
    <div>Powered by VoceEats</div>
    <div>voiceeats.com | Diginetplore</div>
    <div style="margin-top:6px">Thank you for your order!</div>
  </div>
</body>
</html>`;
}

export function browserPrint(
  order: Order,
  restaurant: { name: string; address?: string; phone?: string; logo?: string },
  paperWidth: "58mm" | "80mm" = "80mm"
): void {
  const html = buildReceiptHTML(order, restaurant, paperWidth);
  const printWindow = window.open("", "_blank", "width=500,height=700");
  if (!printWindow) {
    alert("Please allow popups to print receipts");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 1000);
  }, 500);
}

export async function networkPrint(
  order: Order,
  restaurant: { name: string; address?: string; phone?: string; logo?: string },
  printer: Printer
): Promise<{ success: boolean; error?: string }> {
  if (printer.type === "epson_epos") {
    try {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
      <text align="center" font="font_a" width="2" height="2">${restaurant.name}\n</text>
      <text align="center">${restaurant.address || ""}\n</text>
      <text>--------------------------------\n</text>
      <text>Order: ${order.order_number}\n</text>
      <text>Customer: ${order.customer_name || "Voice Order"}\n</text>
      <text>--------------------------------\n</text>
      ${order.items.map((i: any) => `<text>${i.qty}x ${i.name}   $${(i.price * i.qty).toFixed(2)}\n</text>`).join("")}
      <text>--------------------------------\n</text>
      <text>TOTAL: $${order.total.toFixed(2)}\n</text>
      <text align="center">Powered by VoceEats\n</text>
      <cut type="feed"/>
    </epos-print>
  </s:Body>
</s:Envelope>`;

      const response = await fetch(
        `http://${printer.ip_address}:${printer.port}/cgi-bin/epos/service.cgi`,
        { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' }, body: xml }
      );
      if (!response.ok) throw new Error(`Epson error: ${response.status}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  if (printer.type === "star_micronics") {
    try {
      const request = {
        printContents: [
          { type: "text", value: `${restaurant.name}\n`, style: { align: "center", bold: true, fontSize: "large" } },
          { type: "text", value: "--------------------------------\n" },
          { type: "text", value: `Order: ${order.order_number}\n` },
          { type: "text", value: "--------------------------------\n" },
          ...order.items.map((item: any) => ({ type: "text", value: `${item.qty}x ${item.name}   $${(item.price * item.qty).toFixed(2)}\n` })),
          { type: "text", value: "================================\n" },
          { type: "text", value: `TOTAL: $${order.total.toFixed(2)}\n`, style: { bold: true } },
          { type: "text", value: "Powered by VoceEats\n", style: { align: "center" } },
          { type: "cut" },
        ],
      };
      const response = await fetch(`http://${printer.ip_address}/StarWebPRNT/SendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error(`Star error: ${response.status}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  browserPrint(order, restaurant, printer.paper_width);
  return { success: true };
}

export function testPrint(
  printer: Printer,
  restaurant: { name: string; address?: string; phone?: string }
): void {
  const testOrder = {
    id: "test",
    order_number: "TEST-001",
    restaurant_id: "",
    customer_name: "Test Customer",
    customer_phone: "+1 (555) 000-0000",
    items: [
      { id: "1", name: "Test Item One", qty: 1, price: 9.99 },
      { id: "2", name: "Test Item Two", qty: 2, price: 4.99 },
    ],
    notes: "This is a test print",
    subtotal: 19.97,
    tax: 1.75,
    tip: 0,
    platform_fee: 3.00,
    restaurant_payout: 16.97,
    total: 22.72,
    payment_method: "sms_link",
    payment_status: "paid",
    status: "completed",
    source: "voice_ai",
    created_at: new Date().toISOString(),
  } as Order;

  browserPrint(testOrder, restaurant, printer.paper_width);
}
