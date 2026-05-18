import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { restaurantId } = await request.json();

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (!restaurant?.retell_agent_id) {
      return NextResponse.json({ error: "No Retell agent found" }, { status: 400 });
    }

    // First get the agent to find the LLM ID
    const agentResponse = await fetch(
      `https://api.retellai.com/get-agent/${restaurant.retell_agent_id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        },
      }
    );

    const agentData = await agentResponse.json();
    const llmId = agentData?.response_engine?.llm_id;

    console.log(`🤖 Agent: ${restaurant.retell_agent_id}`);
    console.log(`🧠 LLM ID: ${llmId}`);

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
      return NextResponse.json({ error: "No menu items found" }, { status: 400 });
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
- When customer orders an item confirm it WITHOUT saying the price
- NEVER say the price of each item as you take it
- Only say prices when customer specifically asks

WHEN CUSTOMER ASKS ABOUT A CATEGORY:
- List item NAMES only, NO prices
- Example: Customer: "What sandwiches do you have?"
  You: "We have Kubideh Kabob, Chicken, Vegetarian, Salmon Kabob, Lamb Kabob, and Beef Kabob sandwiches."

WHEN CUSTOMER ASKS FOR A PRICE:
- Then and only then tell the price

CONFIRMING ORDER:
- Confirm ALL items together ONCE with total
- Say total price ONCE only

PAYMENT - SMS LINK ONLY:
- Say: "I'll send you a secure payment link by text. What's your phone number?"
- NEVER mention card, cash, or paying in person

IDENTITY:
- Never say you are an AI
- If asked say: "I'm here to take your order!"

CRITICAL:
- Say each item ONCE only
- Keep responses SHORT
- Never repeat order summary more than once

CURRENT MENU:
${menuText}

Tax rate: ${(taxRate * 100).toFixed(1)}%
Restaurant: ${restaurant.name}
All meat is Halal.`;

    // Update the LLM (where prompt actually lives)
    console.log(`🔄 Updating LLM: ${llmId}`);
    const llmResponse = await fetch(
      `https://api.retellai.com/update-retell-llm/${llmId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
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
    console.log(`✅ LLM updated successfully!`);
    console.log(`📋 LLM version: ${llmData.version}`);

    // Now publish the agent
    const publishResponse = await fetch(
      `https://api.retellai.com/publish-agent/${restaurant.retell_agent_id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let published = false;
    if (publishResponse.ok) {
      published = true;
      console.log(`✅ Agent published!`);
    } else {
      const err = await publishResponse.text();
      console.log(`⚠️ Publish error: ${err}`);
    }

    return NextResponse.json({
      success: true,
      items_synced: items.length,
      llm_id: llmId,
      published,
      message: published
        ? "✅ Menu synced and Voice AI published!"
        : "✅ Menu synced — please publish manually in Retell",
    });

  } catch (error: any) {
    console.error("Retell sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Retell sync route active" });
}
