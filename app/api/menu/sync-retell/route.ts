import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { restaurantId } = await request.json();
    const apiKey = process.env.RETELL_API_KEY;

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (!restaurant?.retell_agent_id) {
      return NextResponse.json({ error: "No Retell agent found" }, { status: 400 });
    }

    const agentId = restaurant.retell_agent_id;

    // Get LLM ID from agent
    const agentResponse = await fetch(
      `https://api.retellai.com/get-agent/${agentId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!agentResponse.ok) {
      throw new Error(`Failed to get agent: ${agentResponse.statusText}`);
    }

    const agentData = await agentResponse.json();
    const llmId = agentData?.response_engine?.llm_id;

    if (!llmId) {
      return NextResponse.json({ error: "No LLM ID found" }, { status: 400 });
    }

    // Get menu items
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
    items.forEach(item => {
      const cat = (item.menu_categories as any)?.name || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    const menuText = Object.entries(byCategory)
      .map(([cat, catItems]) => {
        const itemLines = catItems.map(item => {
          const price = item.voiceeats_price || item.price;
          let line = `- ${item.name}: $${Number(price).toFixed(2)}`;
          if (item.description) line += ` (${item.description})`;
          return line;
        }).join("\n");
        return `${cat.toUpperCase()}:\n${itemLines}`;
      }).join("\n\n");

    const taxRate = restaurant.tax_rate || 0.06;

    const prompt = `You are a friendly order taker for ${restaurant.name} powered by VoceEats.

GREETING:
Say: "Thank you for calling ${restaurant.name}! What can I get for you today?"

TAKING ORDERS:
- Confirm items WITHOUT saying the price
- NEVER say item price while taking order
- Only say prices when customer specifically asks

WHEN CUSTOMER ASKS ABOUT A CATEGORY:
- List item NAMES only, NO prices

WHEN CUSTOMER ASKS FOR A PRICE:
- Then and only then tell the price

CONFIRMING ORDER:
- Confirm ALL items together ONCE with total
- Say total ONCE only

PAYMENT - SMS LINK ONLY:
- Say: "I'll send you a secure payment link by text. What's your phone number?"
- NEVER mention card, cash, or paying in person

IDENTITY:
- Never say you are an AI
- If asked say: "I'm here to take your order!"

CRITICAL:
- Say each item ONCE only
- Keep responses SHORT
- Never repeat order summary

CURRENT MENU:
${menuText}

Tax rate: ${(taxRate * 100).toFixed(1)}%
Restaurant: ${restaurant.name}
All meat is Halal.`;

    // Update LLM only — no publish needed
    // LLM changes take effect on next call automatically
    const llmResponse = await fetch(
      `https://api.retellai.com/update-retell-llm/${llmId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ general_prompt: prompt }),
      }
    );

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
