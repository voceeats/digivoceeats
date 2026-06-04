import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const RETELL_BASE = "https://api.retellai.com";

function buildSubmitOrderTool(appUrl: string) {
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

function mergeGeneralTools(existing: unknown[], submitOrderTool: ReturnType<typeof buildSubmitOrderTool>) {
  const tools = (Array.isArray(existing) ? existing : []).filter(
    (t: { name?: string }) => t?.name !== "submit_order",
  );
  tools.push(submitOrderTool);
  const hasEndCall = tools.some(
    (t: { type?: string; name?: string }) => t?.type === "end_call" || t?.name === "end_call",
  );
  if (!hasEndCall) {
    tools.push({
      type: "end_call",
      name: "end_call",
      description: "End the call when the conversation is complete",
    });
  }
  return tools;
}

export async function POST(request: NextRequest) {
  try {
    const { restaurantId } = await request.json();
    const apiKey = process.env.RETELL_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!apiKey || !appUrl) {
      return NextResponse.json({ error: "Missing Retell or app URL config" }, { status: 500 });
    }

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (!restaurant?.retell_agent_id) {
      return NextResponse.json({ error: "No Retell agent found" }, { status: 400 });
    }

    const agentId = restaurant.retell_agent_id;

    const agentResponse = await fetch(`${RETELL_BASE}/get-agent/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!agentResponse.ok) {
      throw new Error(`Failed to get agent: ${agentResponse.statusText}`);
    }

    const agentData = await agentResponse.json();
    const llmId = agentData?.response_engine?.llm_id;

    if (!llmId) {
      return NextResponse.json({ error: "No LLM ID found" }, { status: 400 });
    }

    const llmGetResponse = await fetch(`${RETELL_BASE}/get-retell-llm/${llmId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!llmGetResponse.ok) {
      throw new Error(`Failed to get LLM: ${llmGetResponse.statusText}`);
    }

    const llmExisting = await llmGetResponse.json();

    const { data: items } = await supabaseAdmin
      .from("menu_items")
      .select("*, menu_categories(name)")
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true)
      .order("display_order");

    if (!items?.length) {
      return NextResponse.json({ error: "No menu items" }, { status: 400 });
    }

    const byCategory: Record<string, any[]> = {};
    items.forEach((item) => {
      const cat = (item.menu_categories as any)?.name || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    const menuText = Object.entries(byCategory)
      .map(([cat, catItems]) => {
        const itemLines = catItems
          .map((item) => {
            const price = item.voiceeats_price || item.price;
            let line = `- ${item.name}: $${Number(price).toFixed(2)}`;
            if (item.description) line += ` (${item.description})`;
            return line;
          })
          .join("\n");
        return `${cat.toUpperCase()}:\n${itemLines}`;
      })
      .join("\n\n");

    const taxRate = restaurant.tax_rate || 0.06;
    const taxPct = (taxRate * 100).toFixed(1);

    const prompt = `You are a friendly order taker for ${restaurant.name} powered by DigiVoceEats.

ORDER FLOW (follow steps in order):

Step 1 — GREETING:
Say: "Thank you for calling ${restaurant.name}! What can I get for you today?"

Step 2 — TAKE ORDER:
- Confirm items WITHOUT saying the price
- NEVER say item price while taking the order
- Only say prices when the customer specifically asks

Step 3 — CONFIRM ITEMS:
- Recite ALL items together ONCE (no prices unless the customer asked)

Step 4 — CONFIRM TOTAL:
- State the full order total including ${taxPct}% tax ONCE only

Step 5 — CUSTOMER NAME:
- Ask: "Can I get your name for the order?"

Step 6 — SUBMIT ORDER (required before Step 7):
- Call the submit_order function with customer_name, order_summary, order_total, and any special_notes
- order_summary format: "Item Name, qty, $price; Item Name, qty, $price"
- WAIT for the response — you MUST receive payment_code from submit_order before Step 7
- NEVER invent or guess a payment code

Step 7 — PAYMENT INSTRUCTIONS (do NOT send SMS or mention text messages):
Say exactly (replace [name] with the customer's name; read payment_code from submit_order response):

"Perfect [name]! To complete your order, go to digivoceeats.com/pay on your phone or computer and enter your 4-digit code: [read payment_code slowly, ONE character at a time with a brief pause between each character — for example if payment_code is A3F2 say: A ... 3 ... F ... 2]

Your order will be ready 25 minutes after payment. Is there anything else I can help you with?"

PAYMENT CODE RULES:
- payment_code is the LAST 4 CHARACTERS of order_number returned by submit_order
- Read each character separately and clearly — never run characters together
- If the customer asks to repeat, read the code again slowly one character at a time
- Do NOT mention SMS, text messages, or payment links by phone

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
Restaurant: ${restaurant.name}
All meat is Halal.`;

    const submitOrderTool = buildSubmitOrderTool(appUrl);
    const general_tools = mergeGeneralTools(llmExisting.general_tools, submitOrderTool);

    const llmResponse = await fetch(`${RETELL_BASE}/update-retell-llm/${llmId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ general_prompt: prompt, general_tools }),
    });

    if (!llmResponse.ok) {
      const error = await llmResponse.text();
      throw new Error(`LLM update failed: ${error}`);
    }

    const llmData = await llmResponse.json();
    console.log(`✅ LLM updated - version: ${llmData.version}`);

    return NextResponse.json({
      success: true,
      items_synced: items.length,
      llm_id: llmId,
      llm_version: llmData.version,
      message: "✅ Menu synced to Voice AI!",
    });
  } catch (error: any) {
    console.error("Retell sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Retell sync active" });
}
