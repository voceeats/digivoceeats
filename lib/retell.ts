import { supabaseAdmin } from "./supabase";

const RETELL_API_KEY = process.env.RETELL_API_KEY!;
const RETELL_BASE_URL = "https://api.retellai.com";

export function buildMenuPrompt(
  restaurantName: string,
  phone: string,
  items: Array<{
    name: string; price: number; description?: string;
    category?: string; is_available: boolean; allergens?: string[];
  }>
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
      const itemLines = catItems.map((item) => {
        let line = `- ${item.name}: $${item.price.toFixed(2)}`;
        if (item.description) line += ` (${item.description})`;
        if (item.allergens?.length) line += ` [Contains: ${item.allergens.join(", ")}]`;
        return line;
      }).join("\n");
      return `${cat}:\n${itemLines}`;
    }).join("\n\n");

  return `You are a friendly, professional voice ordering assistant for ${restaurantName}.

Your job is to:
1. Greet the customer warmly
2. Take their food order from the menu below
3. Confirm their order and total
4. Collect their name
5. Call submit_order to save the order and get the 4-digit payment code
6. Give payment instructions for digivoceeats.com/pay
7. End the call politely

IMPORTANT RULES:
- Only offer items currently on the menu below
- If an item is not listed, it is not available today
- Always confirm the complete order before submitting
- Be conversational and friendly, not robotic
- Add applicable tax (8.75%) to the total
- Platform service fee of 15% is already included in menu prices
- Do NOT send SMS — customer pays at digivoceeats.com/pay with their 4-digit code

PAYMENT (Step 7):
After submit_order returns payment_code, say:
"Perfect [name]! To complete your order, go to digivoceeats.com/pay on your phone or computer and enter your 4-digit code: [read payment_code slowly, one character at a time]

Your order will be ready 25 minutes after payment. Is there anything else I can help you with?"

- payment_code is the last 4 characters of order_number from submit_order
- Read each character separately with a brief pause between them

CURRENT MENU:
${menuText}

RESTAURANT INFO:
Name: ${restaurantName}
Phone: ${phone}

After taking the order, always say:
"Let me confirm your order: [list items and total]. Can I get your name for the order?"`;
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
    category: (item.menu_categories as any)?.name,
    is_available: item.is_available,
    allergens: item.allergens || [],
  }));

  const prompt = buildMenuPrompt(
    restaurant.name,
    restaurant.phone || "",
    menuItems
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
    }
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
      general_prompt: buildMenuPrompt(restaurant.name, restaurant.phone || "", []),
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

export function parseRetellWebhook(body: any): RetellOrderData | null {
  try {
    const customData = body.custom_data || {};
    return {
      customerName: customData.customer_name,
      customerPhone: customData.customer_phone,
      items: customData.order_items || [],
      paymentMethod: customData.payment_method || "pay_code",
      notes: customData.special_notes,
      callId: body.call_id,
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
