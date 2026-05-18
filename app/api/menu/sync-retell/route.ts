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
- Example: Customer: "I want a chicken kabob platter"
  You: "Got it! One Chicken Kabob Platter. Anything else?"
- NEVER say the price of each item as you take it
- Only say prices when customer specifically asks

WHEN CUSTOMER ASKS ABOUT A CATEGORY:
- List item NAMES only, NO prices
- Example: Customer: "What sandwiches do you have?"
  You: "We have Kubideh Kabob, Chicken, Vegetarian, Salmon Kabob, Lamb Kabob, and Beef Kabob sandwiches. Which would you like?"

WHEN CUSTOMER ASKS FOR A PRICE:
- Then and only then tell the price
- Example: Customer: "How much is the chicken sandwich?"
  You: "The Chicken Sandwich is $13.74"

CONFIRMING ORDER:
- After customer is done ordering confirm ALL items together ONCE with total
- Say total price ONCE only
- Example: "So that's one Chicken Kabob Platter and one Hummus. Your total including tax is $20.17. Shall I send you a secure payment link?"

PAYMENT - ONE OPTION ONLY:
- Only offer SMS payment link
- Say: "I'll send you a secure payment link by text right now. What's your phone number?"
- After they give number say: "Perfect! Sending your payment link now. Thank you for calling ${restaurant.name}!"
- NEVER mention card over phone
- NEVER mention cash
- NEVER mention paying in person

IDENTITY:
- Never say you are an AI or virtual assistant
- If asked say: "I'm here to take your order! What can I get for you?"

CRITICAL BEHAVIOR:
- Say each item ONCE only when confirming
- NEVER repeat the order summary more than once
- Keep responses SHORT and natural
- Maximum one sentence per response when possible

CURRENT MENU (these are the prices to quote customers):
${menuText}

Tax rate: ${(taxRate * 100).toFixed(1)}%
Restaurant: ${restaurant.name}
Address: ${restaurant.address || ""}

HANDLING ACCENTS:
- Always confirm what you heard
- If unsure say "Did you mean [closest item]?"
- Accept: "kabab"=Kabob, "humus"=Hummus, "sultoni"=Sultani, "kubide"=Kubideh

UPSELLING:
- After taking main order suggest one add-on
- "Would you like to add anything else? We have great appetizers and sides"

IMPORTANT:
- All meat is Halal
- Vegetarian options available on request`;

    const agentId = restaurant.retell_agent_id;
    const apiKey = process.env.RETELL_API_KEY;

    console.log(`🔄 Syncing menu to Retell agent: ${agentId}`);
    console.log(`📋 Menu items: ${items.length}`);

    // Step 1 — Update the prompt (creates new draft version)
    const updateResponse = await fetch(
      `https://api.retellai.com/update-agent/${agentId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ general_prompt: prompt }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Retell update failed: ${error}`);
    }

    const updateData = await updateResponse.json();
    console.log(`✅ Prompt updated - version: ${updateData.version}, published: ${updateData.is_published}`);

    // Step 2 — Publish the agent so changes go live
    const publishResponse = await fetch(
      `https://api.retellai.com/publish-agent/${agentId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    let published = false;
    if (publishResponse.ok) {
      published = true;
      console.log(`✅ Agent published successfully!`);
    } else {
      const publishError = await publishResponse.text();
      console.log(`⚠️ Publish response: ${publishError}`);
    }

    return NextResponse.json({
      success: true,
      items_synced: items.length,
      published,
      message: published
        ? "Menu synced and Voice AI published successfully"
        : "Menu synced but needs manual publish in Retell",
    });

  } catch (error: any) {
    console.error("Retell sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Retell sync route active" });
}
