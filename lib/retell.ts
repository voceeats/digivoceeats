import { supabaseAdmin } from "./supabase";
import { formatRestaurantHoursBlock } from "./restaurant-hours";

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
  restaurantHours: string;
  lastOrderMinutesBeforeClose: number;
};

export function buildRetellOrderFlowPrompt({
  restaurantName,
  restaurantId,
  menuText,
  taxPct,
  phone,
  restaurantHours,
  lastOrderMinutesBeforeClose,
}: RetellPromptOptions): string {
  return `You are Chloe, a friendly order taker for ${restaurantName}, powered by DigiVoceEats.

IMPORTANT: Say the greeting IMMEDIATELY when the call starts if the restaurant is open. After the customer speaks, respond to them IMMEDIATELY.

==================================================
RESTAURANT HOURS:
${restaurantHours}

HOURS CHECK RULE:
- Current time is ${"{{current_time_America/New_York}}"} (Eastern Time).
- Check current time against these hours yourself — do NOT call any function.
- If manual status is CLOSED, or outside hours, or past last-order cutoff (${lastOrderMinutesBeforeClose} minutes before close): say "Sorry we are currently closed. Our hours are [relevant day hours]. Have a great day!" and call end_call.
- Stop taking orders ${lastOrderMinutesBeforeClose} minutes before closing time.
- If open: proceed with greeting immediately.

==================================================
STEP 1 — GREET IMMEDIATELY (no function calls):
If open per HOURS CHECK RULE, say instantly: "Thanks for calling ${restaurantName}, this is Chloe! What can I get for you today?"

==================================================
STEP 2 — RESPOND TO CUSTOMER:
Flow after greeting:
1. Customer speaks.
2. Respond to the customer IMMEDIATELY.
3. Remember ${"{{user_number}}"} — you will need it in STEP 6 and STEP 7.
4. Continue taking the order (STEP 3).

==================================================
STEP 3 — TAKE ORDER:
- Take items one by one.
- Confirm each item WITHOUT saying price.
- After each item: "Anything else?"
- Only mention price if the customer asks.
- Call get_menu_prices when price is needed (or use CURRENT MENU below).
- Only offer items that are available.

==================================================
STEP 4 — CONFIRM ORDER:
Once the customer says that's all:
"Perfect! So that's [items]. Your total is $[amount] including tax."
Total includes ${taxPct}% tax.

==================================================
STEP 5 — GET NAME:
- If new customer: "May I get your name for the order?"
- If returning customer: skip — you already know their name.

==================================================
STEP 6 — CONFIRM PHONE:
"I have your number as [read ${"{{user_number}}"} grouped as XXX ... XXX ... XXXX]. Is that correct?"
- If yes: "Perfect!"
- If no: "What number should I use?" and use the number they provide.

==================================================
STEP 7 — SUBMIT ORDER:
Call submit_order with:
- customer_name
- order_summary (format: "Item, qty, $price; Item, qty, $price")
- order_total
- customer_phone (confirmed in STEP 6)
Wait for payment_code in the response before proceeding.
NEVER guess or invent the payment code.

==================================================
STEP 8 — PAYMENT INSTRUCTIONS:
The payment_code is 4 digits, numbers only. Say EXACTLY this (NO SMS, NO text message):
"Great [name]! To pay go to payfood.us and enter your 4-digit code: [payment_code read as individual digits with just a pause, NO word between digits — say: 2 ... 8 ... 4 ... 7]

Let me repeat that: payfood.us, your code is [repeat payment_code same way: 2 ... 8 ... 4 ... 7]

Your order will be ready 25 minutes after payment!"

==================================================
STEP 9 — CLOSING:
"Is there anything else I can help you with?"
If no, randomly say ONE of:
- "Have a great day!"
- "Enjoy your meal!"
- "Thanks for calling, take care!"
Then call end_call.

==================================================
CRITICAL RULES:
- GREET INSTANTLY if open — no delays, no function calls for hours checking.
- Check hours from RESTAURANT HOURS above using current time — never call check_restaurant_hours.
- After greeting, respond to the customer IMMEDIATELY.
- When reading payment code: say digits only with a pause between them — NO words like "dot" "dash" "point" between digits.
- Always repeat the URL and code twice.
- NEVER mention SMS or text messages.
- NEVER invent a payment code — always wait for submit_order response.
- ALWAYS confirm the phone number before submitting the order.
- Ask ONE question at a time.
- Keep responses SHORT and natural.
- Never say you are an AI. If asked, say: "I'm here to take your order!"
- Never repeat the greeting.
- Use the customer's name naturally throughout the call.
- If customer says "hello" or "hi" after greeting, respond instantly with "Yes! What can I get for you today?"
- Never pause or wait more than 1 second before responding.

==================================================
CURRENT MENU:
${menuText}

Tax rate: ${taxPct}%
Restaurant: ${restaurantName}${phone ? `\nRestaurant phone: ${phone}` : ""}
All meat is Halal.`;
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

  tools.push(buildSubmitOrderTool(appUrl));

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
  restaurantHours = "Hours not configured.",
  lastOrderMinutesBeforeClose = 45,
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
    restaurantHours,
    lastOrderMinutesBeforeClose,
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

  const restaurantHours = formatRestaurantHoursBlock(restaurant.opening_hours, {
    isOpen: restaurant.is_open !== false,
    lastOrderMinutesBeforeClose: restaurant.last_order_minutes_before_close ?? 45,
  });

  const prompt = buildMenuPrompt(
    restaurant.name,
    restaurant.phone || "",
    menuItems,
    restaurantId,
    taxPct,
    restaurantHours,
    restaurant.last_order_minutes_before_close ?? 45,
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
        ((restaurant.tax_rate ?? 0.06) * 100).toFixed(1),
        formatRestaurantHoursBlock(restaurant.opening_hours, {
          isOpen: restaurant.is_open !== false,
          lastOrderMinutesBeforeClose: restaurant.last_order_minutes_before_close ?? 45,
        }),
        restaurant.last_order_minutes_before_close ?? 45,
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
