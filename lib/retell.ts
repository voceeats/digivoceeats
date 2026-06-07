import { supabaseAdmin } from "./supabase";

const RETELL_API_KEY = process.env.RETELL_API_KEY!;
const RETELL_BASE_URL = "https://api.retellai.com";

export type MenuItemForPrompt = {
  name: string;
  voiceeats_price: number;
  description?: string | null;
  category?: string;
};

/** Build menu block for Retell prompt — available items only, voiceeats_price, grouped by category. */
export function formatMenuTextForPrompt(items: MenuItemForPrompt[]): string {
  const byCategory: Record<string, MenuItemForPrompt[]> = {};
  items.forEach((item) => {
    const cat = item.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  return Object.entries(byCategory)
    .map(([cat, catItems]) => {
      const itemLines = catItems
        .map((item) => {
          const amount = Number(item.voiceeats_price);
          let line = `${item.name}: $${amount.toFixed(2)}`;
          if (item.description?.trim()) {
            line += ` (${item.description.trim()})`;
          }
          return line;
        })
        .join("\n");
      return `${cat.toUpperCase()}:\n${itemLines}`;
    })
    .join("\n\n");
}

export type RetellPromptOptions = {
  restaurantName: string;
  restaurantId?: string;
  menuText: string;
  taxPct: string;
  phone?: string;
};

export function buildRetellOrderFlowPrompt({
  restaurantName,
  restaurantId,
  menuText,
  taxPct,
  phone,
}: RetellPromptOptions): string {
  return `You are Chloe, a friendly phone order taker for ${restaurantName}, powered by DigiVoceEats.
You take orders over the phone. Follow the EXACT flow below in order. Do NOT skip steps.
Ask only ONE question at a time. Keep every response SHORT and natural.

==================================================
STEP 0 — CHECK HOURS:
- Call check_restaurant_hours immediately at the start of the call.
- If the restaurant is closed (is_open is false or accepting_orders is false):
  - Tell the customer the reason from the response, then say "Have a great day!" and call end_call.
- If open: proceed to STEP 1.

==================================================
STEP 1 — IDENTIFY CALLER:
- The caller's phone number is ${"{{user_number}}"}.
- Call lookup_customer with phone=${"{{user_number}}"} immediately.
- Remember this phone number — you will need it in STEP 5 and STEP 6.
- If lookup_customer returns a returning customer WITH first_name, say:
  "Thanks for calling ${restaurantName}, this is Chloe! Welcome back [first_name], what can I get for you today?"
- If NEW customer (not found), say:
  "Thanks for calling ${restaurantName}, this is Chloe! What can I get for you today?"

==================================================
STEP 2 — TAKE ORDER:
- Take items one by one, naturally.
- Confirm each item WITHOUT saying its price.
- After each item ask: "Anything else?"
- Only mention a price if the customer specifically asks.
- When a price is needed, use the prices in CURRENT MENU below (call get_menu_prices only if it is available to you).
- Only offer items that are available on the menu.

==================================================
STEP 3 — CONFIRM FULL ORDER:
- Once the customer says that's all, say:
  "Perfect! So that's [list all items]. Your total comes to $[amount] including tax."
- Total includes ${taxPct}% tax.

==================================================
STEP 4 — GET CUSTOMER NAME:
- If NEW customer: say "May I get your name for the order?"
- If RETURNING customer: SKIP this step — you already know their name.

==================================================
STEP 5 — CONFIRM PHONE NUMBER:
- Use the caller's number ${"{{user_number}}"} (or the number returned by lookup_customer).
- Say: "I have your number as [read the 10 digits slowly, grouped as XXX ... XXX ... XXXX]. Is that the right number for your order?"
- If yes: say "Perfect!"
- If no: say "What number should I use?" and use the new number.

==================================================
STEP 6 — SUBMIT ORDER:
- Call submit_order with:
  - customer_name
  - order_summary (format: "Item, qty, $price; Item, qty, $price")
  - order_total
  - customer_phone (the confirmed phone number from STEP 5)
- WAIT for the payment_code in the response before saying anything about payment.
- NEVER invent or guess a payment code.

==================================================
STEP 7 — PAYMENT INSTRUCTIONS:
The payment_code is 4 digits, numbers only. Say EXACTLY this (NO SMS, NO text message — never mention SMS):
"Great [name]! To pay for your order, go to payfood.us — that's P-A-Y-F-O-O-D dot U-S — and enter your 4-digit code: [read each digit of payment_code slowly one at a time with a brief pause between each digit]. Your order will be ready 25 minutes after payment!"

==================================================
STEP 8 — ANYTHING ELSE:
- Say: "Is there anything else I can help you with?"
- If no, randomly say ONE of:
  - "Have a great day!"
  - "Enjoy your meal!"
  - "Thanks for calling, take care!"
- Then call end_call.

==================================================
CRITICAL RULES:
- NEVER mention SMS, text message, or a payment link sent by phone.
- NEVER send or mention sending any message to the customer's phone.
- NEVER invent a payment code — always WAIT for the submit_order response.
- ALWAYS confirm the phone number before submitting the order.
- Ask only ONE question at a time.
- Keep responses SHORT and natural.
- Never say you are an AI. If asked, say: "I'm here to take your order!"
- Only show/offer available items.
- After greeting, immediately listen for customer response.
- If customer says "hello" or "hi" respond instantly with "Yes! What can I get for you today?"
- Never pause or wait more than 1 second before responding.
- IF CUSTOMER SAYS they forgot their code or asks for their order code:
  - Call get_unpaid_order with phone=${"{{user_number}}"}.
  - If order found: say "I found your order! Your 4-digit code is: [read payment_code slowly one digit at a time]. Go to payfood.us and enter this code to complete payment."
  - If no order found: say "I don't see any pending orders for your number. Would you like to place a new order?"

==================================================
CURRENT MENU:
${menuText}

Tax rate: ${taxPct}%
Restaurant: ${restaurantName}${phone ? `\nRestaurant phone: ${phone}` : ""}
All meat is Halal.`;
}

export function buildCheckHoursTool(appUrl: string, restaurantId: string) {
  return {
    type: "custom",
    name: "check_restaurant_hours",
    description:
      "Check if the restaurant is open and accepting orders right now. Call this FIRST at the start of every call before taking an order.",
    url: `${appUrl}/api/restaurant/hours?restaurantId=${restaurantId}`,
    method: "GET",
    speak_during_execution: false,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {},
    },
  };
}

export function buildLookupCustomerTool(appUrl: string) {
  return {
    type: "custom",
    name: "lookup_customer",
    description:
      "Look up a returning customer by phone number. Call this FIRST after the hours check, passing the caller's number {{user_number}}. Returns first_name and phone if they are a returning customer.",
    url: `${appUrl}/api/customer/lookup`,
    method: "GET",
    speak_during_execution: false,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description:
            "Caller phone number in any format. Use the call's {{user_number}} dynamic variable.",
        },
      },
      required: ["phone"],
    },
  };
}

export function buildGetUnpaidOrderTool(appUrl: string) {
  return {
    type: "custom",
    name: "get_unpaid_order",
    description:
      "Look up customer's unpaid order by phone number to retrieve their payment code if they forgot it. Returns payment_code, order_number, total, and items summary for orders placed in the last 2 hours.",
    url: `${appUrl}/api/order/lookup-by-phone`,
    method: "GET",
    speak_during_execution: false,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description:
            "Caller phone number in any format. Use the call's {{user_number}} dynamic variable.",
        },
      },
      required: ["phone"],
    },
  };
}

export function buildSubmitOrderTool(appUrl: string) {
  return {
    type: "custom",
    name: "submit_order",
    description:
      "MANDATORY: Submit the confirmed order and receive the 4-digit payment_code. Call ONLY after Step 5B (phone confirmed). MUST complete successfully before Step 7. Returns payment_code (last 4 characters of order_number).",
    url: `${appUrl}/api/retell/submit-order`,
    method: "POST",
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "One moment while I submit your order.",
    parameters: {
      type: "object",
      properties: {
        customer_name: {
          type: "string",
          description: "Customer name for the order",
        },
        customer_phone: {
          type: "string",
          description: "Phone number confirmed in Step 5B (10 digits, any format)",
        },
        order_summary: {
          type: "string",
          description:
            'Semicolon-separated items with qty and voiceeats_price, e.g. "Kubideh Platter, 1, $14.89; Basmati Rice, 1, $3.44"',
        },
        order_total: {
          type: "string",
          description: "Final order total including tax",
        },
        special_notes: {
          type: "string",
          description: "Special instructions or allergies",
        },
      },
      required: ["customer_name", "customer_phone", "order_summary", "order_total"],
    },
  };
}

export function mergeRetellGeneralTools(
  existing: unknown[],
  appUrl: string,
  restaurantId: string,
): unknown[] {
  const reserved = new Set([
    "check_restaurant_hours",
    "lookup_customer",
    "get_unpaid_order",
    "submit_order",
  ]);
  const tools = (Array.isArray(existing) ? existing : []).filter(
    (t: { name?: string }) => !reserved.has(t?.name ?? ""),
  );

  tools.push(
    buildCheckHoursTool(appUrl, restaurantId),
    buildLookupCustomerTool(appUrl),
    buildGetUnpaidOrderTool(appUrl),
    buildSubmitOrderTool(appUrl),
  );

  const hasEndCall = tools.some(
    (t: { type?: string; name?: string }) =>
      t?.type === "end_call" || t?.name === "end_call",
  );
  if (!hasEndCall) {
    tools.push({
      type: "end_call",
      name: "end_call",
      description: "End the call after Step 8 when the customer is done",
    });
  }

  return tools;
}

export function buildMenuPrompt(
  restaurantName: string,
  phone: string,
  items: Array<{
    name: string;
    voiceeats_price: number;
    description?: string | null;
    category?: string;
    is_available: boolean;
    allergens?: string[];
  }>,
  restaurantId?: string,
  taxPct = "8.75",
): string {
  const availableItems = items
    .filter((i) => i.is_available)
    .map((item) => ({
      name: item.name,
      voiceeats_price: item.voiceeats_price,
      description: item.description,
      category: item.category,
    }));

  const menuText = formatMenuTextForPrompt(availableItems);

  return buildRetellOrderFlowPrompt({
    restaurantName,
    restaurantId,
    menuText,
    taxPct,
    phone,
  });
}

export async function syncMenuToRetell(restaurantId: string) {
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.retell_agent_id) {
    console.log("No Retell agent configured for restaurant", restaurantId);
    return;
  }

  const { data: items } = await supabaseAdmin
    .from("menu_items")
    .select("*, menu_categories(name)")
    .eq("restaurant_id", restaurantId)
    .eq("is_available", true)
    .order("display_order");

  if (!items) return;

  const menuItems = items.map((item) => ({
    name: item.name,
    voiceeats_price: Number(item.voiceeats_price ?? item.price * 1.15),
    description: item.description,
    category: (item.menu_categories as { name?: string })?.name,
    is_available: true,
    allergens: item.allergens || [],
  }));

  const taxPct = ((restaurant.tax_rate ?? 0.06) * 100).toFixed(1);

  const prompt = buildMenuPrompt(
    restaurant.name,
    restaurant.phone || "",
    menuItems,
    restaurantId,
    taxPct,
  );

  const response = await fetch(
    `${RETELL_BASE_URL}/update-agent/${restaurant.retell_agent_id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        general_prompt: prompt,
        language: "en-US",
        voice_id: "11labs-Adrian",
        responsiveness: 1,
        interruption_sensitivity: 1,
        enable_backchannel: true,
      }),
    },
  );

  if (!response.ok) throw new Error(`Retell sync failed: ${response.statusText}`);
  console.log(`✅ Retell menu synced for ${restaurant.name}`);
  return response.json();
}

export async function createRetellAgent(restaurantId: string) {
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) throw new Error("Restaurant not found");

  const response = await fetch(`${RETELL_BASE_URL}/create-agent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_name: `${restaurant.name} - DigiVoceEats`,
      general_prompt: buildMenuPrompt(
        restaurant.name,
        restaurant.phone || "",
        [],
        restaurantId,
      ),
      voice_id: "11labs-Adrian",
      language: "en-US",
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/retell/webhook`,
      responsiveness: 1,
      interruption_sensitivity: 1,
      end_call_after_silence_ms: 600000,
      max_call_duration_ms: 900000,
      metadata: { restaurant_id: restaurantId },
    }),
  });

  const agent = await response.json();

  await supabaseAdmin
    .from("restaurants")
    .update({ retell_agent_id: agent.agent_id })
    .eq("id", restaurantId);

  return agent;
}

export interface RetellOrderData {
  customerName?: string;
  customerPhone?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  paymentMethod: "sms_link" | "ivr" | "in_person" | "pay_code";
  notes?: string;
  callId: string;
}

export function parseRetellWebhook(body: {
  custom_data?: Record<string, unknown>;
  call_id?: string;
}): RetellOrderData | null {
  try {
    const customData = body.custom_data || {};
    return {
      customerName: customData.customer_name as string | undefined,
      customerPhone: customData.customer_phone as string | undefined,
      items: (customData.order_items as RetellOrderData["items"]) || [],
      paymentMethod: (customData.payment_method as RetellOrderData["paymentMethod"]) || "pay_code",
      notes: customData.special_notes as string | undefined,
      callId: body.call_id || "",
    };
  } catch {
    return null;
  }
}

export function verifyRetellWebhook(body: string, signature: string): boolean {
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", process.env.RETELL_WEBHOOK_SECRET!);
  hmac.update(body);
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
