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
4. Ask how they want to pay (SMS payment link, pay by card over phone, or pay in person)
5. Collect their name and phone number if not already known
6. Confirm everything and end the call politely

IMPORTANT RULES:
- Only offer items currently on the menu below
- If an item is not listed, it is not available today
- Always confirm the complete order before asking for payment
- Be conversational and friendly, not robotic
- Add applicable tax (8.75%) to the total
- Platform service fee of 15% is already included in menu prices

PAYMENT OPTIONS TO OFFER:
1. "I can send you a secure payment link by text" (SMS link - recommended)
2. "You can enter your card details on your phone keypad" (IVR - secure)
3. "You can pay when you arrive or pick up" (in person)

CURRENT MENU:
${menuText}

RESTAURANT INFO:
Name: ${restaurantName}
Phone: ${phone}

After taking the order, always say:
"Let me confirm your order: [list items and total]. How would you like to pay - shall I send you a secure payment link by text, would you prefer to pay by card over the phone, or will you pay in person?"`;
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
  paymentMethod: "sms_link" | "ivr" | "in_person";
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
      paymentMethod: customData.payment_method || "sms_link",
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
