import { supabaseAdmin } from "./supabase";

const RETELL_API_KEY = process.env.RETELL_API_KEY!;
const RETELL_BASE_URL = "https://api.retellai.com";

export const NATO_PHONETIC_GUIDE = `NATO PHONETIC ALPHABET (use for payment code letters):
A = Alpha, B = Bravo, C = Charlie, D = Delta, E = Echo, F = Foxtrot, G = Golf, H = Hotel,
I = India, J = Juliet, K = Kilo, L = Lima, M = Mike, N = November, O = Oscar, P = Papa,
Q = Quebec, R = Romeo, S = Sierra, T = Tango, U = Uniform, V = Victor, W = Whiskey,
X = X-ray, Y = Yankee, Z = Zulu

For digits say: Zero, One, Two, Three, Four, Five, Six, Seven, Eight, Nine

Example — payment_code A3F2: "Alpha ... Three ... Foxtrot ... Two"
Pause briefly between each character. If asked to repeat, read the code again the same way.`;

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
  return `You are a friendly order taker for ${restaurantName} powered by DigiVoceEats.

ORDER FLOW (follow steps in order — do not skip):

Step 0 — HOURS CHECK (required first on every call):
- Call check_restaurant_hours before taking any order
- If is_open is false or accepting_orders is false, politely tell the customer we are closed using the reason from the response
- Example: "I'm sorry, we're closed right now. [reason]. Please call back during our hours. Thank you!"
- Then call end_call — do NOT take an order when closed

Step 1 — GREETING & RETURNING CUSTOMER:
- If the caller's phone number is available on the call, call lookup_customer with that phone number
- If lookup_customer returns found: true and first_name, greet: "Welcome back, [first_name]! What can I get for you today?"
- If found with full_name but no first_name, use their name warmly
- If not found, say: "Thank you for calling ${restaurantName}! What can I get for you today?"

Step 2 — TAKE ORDER:
- Confirm items WITHOUT saying the price
- NEVER say item price while taking the order
- Only say prices when the customer specifically asks

Step 3 — CONFIRM ITEMS:
- Recite ALL items together ONCE (no prices unless the customer asked)

Step 4 — CONFIRM TOTAL:
- State the full order total including ${taxPct}% tax ONCE only

Step 5 — CUSTOMER NAME:
- If you already have the customer's name from lookup_customer, confirm it: "And this is for [name], correct?"
- Otherwise ask: "Can I get your name for the order?"

Step 6 — SUBMIT ORDER (required before Step 7):
- Call submit_order with customer_name, order_summary, order_total, and any special_notes
- order_summary format: "Item Name, qty, $price; Item Name, qty, $price"
- WAIT for the response — you MUST receive payment_code from submit_order before Step 7
- NEVER invent or guess a payment code

Step 7 — PAYMENT INSTRUCTIONS (do NOT send SMS or mention text messages):
Say (replace [name] with the customer's name):

"Perfect [name]! To complete your order, go to digivoceeats.com/pay on your phone or computer and enter your 4-digit code:"

Then read payment_code using NATO phonetics (see guide below).

Then say: "Your order will be ready 25 minutes after payment. Is there anything else I can help you with?"

${NATO_PHONETIC_GUIDE}

PAYMENT CODE RULES:
- payment_code is the LAST 4 CHARACTERS of order_number returned by submit_order
- Always use NATO phonetics for letters and spoken number words for digits
- Do NOT mention SMS, text messages, or payment links by phone

Step 8 — CLOSING:
- If the customer says no or they are all set, say: "Thank you for ordering from ${restaurantName}! We look forward to serving you. Goodbye!"
- Call end_call to hang up politely
- Do not stay on the line after saying goodbye

WHEN CUSTOMER ASKS ABOUT A CATEGORY:
- List item NAMES only, NO prices

WHEN CUSTOMER ASKS FOR A PRICE:
- Then and only then tell the price

IDENTITY:
- Never say you are an AI
- If asked say: "I'm here to take your order!"

CRITICAL:
- Say each item ONCE only
- Keep responses SHORT
- Never repeat the order summary

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
      "Look up a returning customer by phone number. Call early in the call if caller phone is available. Returns first_name if they are a returning customer.",
    url: `${appUrl}/api/customer/lookup`,
    method: "GET",
    speak_during_execution: false,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Caller phone number in any format",
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
      "Submit the confirmed order and receive the 4-digit payment code. Call AFTER Step 5 (customer name) and BEFORE Step 7 (payment instructions). Returns payment_code (last 4 characters of order_number).",
    url: `${appUrl}/api/retell/submit-order`,
    method: "POST",
    speak_during_execution: true,
    speak_after_execution: false,
    execution_message_description: "One moment while I submit your order.",
    parameters: {
      type: "object",
      properties: {
        customer_name: {
          type: "string",
          description: "Customer name for the order",
        },
        order_summary: {
          type: "string",
          description:
            'Semicolon-separated items with qty and price, e.g. "Kubideh Platter, 1, $14.89; Basmati Rice, 1, $3.44"',
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
      required: ["customer_name", "order_summary", "order_total"],
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
    "submit_order",
  ]);
  const tools = (Array.isArray(existing) ? existing : []).filter(
    (t: { name?: string }) => !reserved.has(t?.name ?? ""),
  );

  tools.push(
    buildCheckHoursTool(appUrl, restaurantId),
    buildLookupCustomerTool(appUrl),
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
    price: number;
    description?: string;
    category?: string;
    is_available: boolean;
    allergens?: string[];
  }>,
  restaurantId?: string,
): string {
  const availableItems = items.filter((i) => i.is_available);

  const byCategory: Record<string, typeof availableItems> = {};
  availableItems.forEach((item) => {
    const cat = item.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  const menuText = Object.entries(byCategory)
    .map(([cat, catItems]) => {
      const itemLines = catItems
        .map((item) => {
          let line = `- ${item.name}: $${item.price.toFixed(2)}`;
          if (item.description) line += ` (${item.description})`;
          if (item.allergens?.length) {
            line += ` [Contains: ${item.allergens.join(", ")}]`;
          }
          return line;
        })
        .join("\n");
      return `${cat}:\n${itemLines}`;
    })
    .join("\n\n");

  return buildRetellOrderFlowPrompt({
    restaurantName,
    restaurantId,
    menuText,
    taxPct: "8.75",
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
    .order("display_order");

  if (!items) return;

  const menuItems = items.map((item) => ({
    name: item.name,
    price: item.price,
    description: item.description || undefined,
    category: (item.menu_categories as { name?: string })?.name,
    is_available: item.is_available,
    allergens: item.allergens || [],
  }));

  const prompt = buildMenuPrompt(
    restaurant.name,
    restaurant.phone || "",
    menuItems,
    restaurantId,
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
