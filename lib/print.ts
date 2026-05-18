export interface PrintOrder {
  order_number: string;
  customer_name?: string;
  customer_phone?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  tax: number;
  total: number;
  platform_fee: number;
  restaurant_payout: number;
  payment_method?: string;
  notes?: string;
  restaurant_name: string;
  restaurant_address?: string;
  restaurant_phone?: string;
  created_at: string;
}

// Format receipt text for thermal printers
function formatReceipt(order: PrintOrder): string {
  const line = "─".repeat(32);
  const center = (text: string, width = 32) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(pad) + text;
  };
  const row = (left: string, right: string, width = 32) => {
    const space = width - left.length - right.length;
    return left + " ".repeat(Math.max(1, space)) + right;
  };

  const time = new Date(order.created_at).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit"
  });
  const date = new Date(order.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });

  let receipt = "";
  receipt += center(order.restaurant_name) + "\n";
  if (order.restaurant_address) receipt += center(order.restaurant_address) + "\n";
  if (order.restaurant_phone) receipt += center(order.restaurant_phone) + "\n";
  receipt += "\n";
  receipt += center("*** VOICE AI ORDER ***") + "\n";
  receipt += "\n";
  receipt += row("Order:", order.order_number) + "\n";
  receipt += row("Date:", date) + "\n";
  receipt += row("Time:", time) + "\n";
  if (order.customer_name) receipt += row("Customer:", order.customer_name) + "\n";
  if (order.customer_phone) receipt += row("Phone:", order.customer_phone) + "\n";
  receipt += line + "\n";
  receipt += "ITEMS:\n";
  receipt += line + "\n";

  order.items.forEach(item => {
    const itemTotal = `$${(item.price * item.qty).toFixed(2)}`;
    receipt += row(`${item.qty}x ${item.name}`, itemTotal) + "\n";
  });

  receipt += line + "\n";
  receipt += row("Subtotal:", `$${order.subtotal.toFixed(2)}`) + "\n";
  receipt += row("Tax (6%):", `$${order.tax.toFixed(2)}`) + "\n";
  receipt += row("TOTAL:", `$${order.total.toFixed(2)}`) + "\n";
  receipt += line + "\n";
  receipt += row("Payment:", (order.payment_method || "").replace(/_/g, " ")) + "\n";
  receipt += row("Restaurant gets:", `$${order.restaurant_payout.toFixed(2)}`) + "\n";

  if (order.notes) {
    receipt += line + "\n";
    receipt += "NOTES:\n";
    receipt += order.notes + "\n";
  }

  receipt += line + "\n";
  receipt += center("Powered by VoceEats") + "\n";
  receipt += center("digivoceeats.com") + "\n";
  receipt += "\n\n\n";

  return receipt;
}

// Generate HTML receipt for browser printing
function generateReceiptHTML(order: PrintOrder): string {
  const time = new Date(order.created_at).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit"
  });
  const date = new Date(order.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${order.order_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 12px;
          width: 80mm;
          margin: 0 auto;
          padding: 8px;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .large { font-size: 14px; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .total-row { font-weight: bold; font-size: 14px; }
        .section { margin: 6px 0; }
        @media print {
          body { width: 80mm; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <div class="center bold large">${order.restaurant_name}</div>
      ${order.restaurant_address ? `<div class="center">${order.restaurant_address}</div>` : ""}
      ${order.restaurant_phone ? `<div class="center">${order.restaurant_phone}</div>` : ""}
      <div class="line"></div>
      <div class="center bold">*** VOICE AI ORDER ***</div>
      <div class="line"></div>
      <div class="section">
        <div class="row"><span>Order:</span><span>${order.order_number}</span></div>
        <div class="row"><span>Date:</span><span>${date}</span></div>
        <div class="row"><span>Time:</span><span>${time}</span></div>
        ${order.customer_name ? `<div class="row"><span>Customer:</span><span>${order.customer_name}</span></div>` : ""}
        ${order.customer_phone ? `<div class="row"><span>Phone:</span><span>${order.customer_phone}</span></div>` : ""}
      </div>
      <div class="line"></div>
      <div class="bold">ITEMS:</div>
      <div class="line"></div>
      <div class="section">
        ${order.items.map(item => `
          <div class="row">
            <span>${item.qty}x ${item.name}</span>
            <span>$${(item.price * item.qty).toFixed(2)}</span>
          </div>
        `).join("")}
      </div>
      <div class="line"></div>
      <div class="section">
        <div class="row"><span>Subtotal:</span><span>$${order.subtotal.toFixed(2)}</span></div>
        <div class="row"><span>Tax (6%):</span><span>$${order.tax.toFixed(2)}</span></div>
        <div class="row total-row"><span>TOTAL:</span><span>$${order.total.toFixed(2)}</span></div>
      </div>
      <div class="line"></div>
      <div class="section">
        <div class="row"><span>Payment:</span><span>${(order.payment_method || "").replace(/_/g, " ")}</span></div>
        <div class="row"><span>Your payout:</span><span>$${order.restaurant_payout.toFixed(2)}</span></div>
      </div>
      ${order.notes ? `
        <div class="line"></div>
        <div class="bold">NOTES:</div>
        <div>${order.notes}</div>
      ` : ""}
      <div class="line"></div>
      <div class="center">Powered by VoceEats</div>
      <div class="center">digivoceeats.com</div>
    </body>
    </html>
  `;
}

// Try Epson ePOS network printer
async function tryEpsonPrint(
  order: PrintOrder,
  ipAddress: string,
  port = 8008
): Promise<boolean> {
  try {
    const receipt = formatReceipt(order);
    const response = await fetch(`http://${ipAddress}:${port}/cgi-bin/epos/service.cgi`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: `<?xml version="1.0" encoding="utf-8"?>
        <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
          <s:Body>
            <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
              <text lang="en">${receipt}</text>
              <cut type="feed"/>
            </epos-print>
          </s:Body>
        </s:Envelope>`,
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Try Star network printer
async function tryStarPrint(
  order: PrintOrder,
  ipAddress: string,
  port = 9100
): Promise<boolean> {
  try {
    const receipt = formatReceipt(order);
    const response = await fetch(`/api/print/star`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipAddress, port, text: receipt }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Browser window.print fallback
function browserPrint(order: PrintOrder): void {
  const html = generateReceiptHTML(order);
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

// Detect available printers and auto-select
export async function detectAndPrint(
  order: PrintOrder,
  savedPrinters: Array<{ type: string; ip_address?: string; port?: number }> = []
): Promise<{ success: boolean; method: string }> {
  // Try saved network printers first
  for (const printer of savedPrinters) {
    if (printer.type === "epson" && printer.ip_address) {
      const success = await tryEpsonPrint(order, printer.ip_address, printer.port);
      if (success) return { success: true, method: "Epson Network Printer" };
    }
    if (printer.type === "star" && printer.ip_address) {
      const success = await tryStarPrint(order, printer.ip_address, printer.port);
      if (success) return { success: true, method: "Star Network Printer" };
    }
  }

  // Try common network printer IPs on local network
  const commonIPs = ["192.168.1.100", "192.168.1.101", "192.168.0.100"];
  for (const ip of commonIPs) {
    const success = await tryEpsonPrint(order, ip);
    if (success) return { success: true, method: `Auto-detected printer at ${ip}` };
  }

  // Fall back to browser print
  browserPrint(order);
  return { success: true, method: "Browser Print" };
}

export { browserPrint, generateReceiptHTML };
