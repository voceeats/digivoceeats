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

    const prompt = `You are a friendly, professional voice ordering assistant for ${restaurant.name} powered by VoceEats.

Your job is to:
1. Greet the customer warmly by saying "Thank you for calling, welcome to ${restaurant.name}. I am your AI ordering assistant. How can I help you today?"
2. Take their food order from the menu below
3. Confirm the complete order and total
4. Ask how they want to pay
5. Collect their name and phone number
6. Confirm everything and end the call politely

RULES:
- Only offer items currently on the menu below
- Always confirm order before asking for payment
- Be friendly and conversational
- Add ${(taxRate * 100).toFixed(1)}% tax to the total
- Always use the prices listed below
- If customer asks why price differs from website say "Our phone ordering includes a small convenience fee"

PAYMENT OPTIONS:
1. SMS payment link: "I can send you a secure payment link by text right now"
2. Card over phone: "I can take your card details securely over the phone"
3. Cash on arrival: "You are welcome to pay cash when you arrive or pick up"

After confirming order say:
"Your total is $X including tax. Would you like me to send a secure payment link, pay by card now, or pay cash when you arrive?"

CURRENT MENU:
${menuText}

Tax rate: ${(taxRate * 100).toFixed(1)}%
Restaurant: ${restaurant.name}
Address: ${restaurant.address || ""}
Phone: ${restaurant.phone || ""}

HANDLING ACCENTS AND UNCLEAR SPEECH:
- Always repeat back what you heard
- If unsure offer the closest menu item
- Never say "I didn't understand" - always offer options
- Say "Did you mean [closest item]?" if unclear

UPSELLING:
- After taking main order always suggest one add-on
- "Would you like to add anything else? We have great appetizers and sides"

IMPORTANT NOTES:
- All meat is Halal
- Vegetarian options available: Vegetarian Grape Leaves, Shirazi, Vegetarian Sandwich, Veggie Kabob Platter, Hummus, Basmati Rice, Torshi, Lentil Soup`;

    const response = await fetch(
      `https://api.retellai.com/update-agent/${restaurant.retell_agent_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ general_prompt: prompt, publish: true }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Retell sync failed: ${error}`);
    }

    console.log(`✅ Retell synced for ${restaurant.name} - ${items.length} items`);
    return NextResponse.json({
      success: true,
      items_synced: items.length,
      message: "Menu synced to Voice AI successfully"
    });

  } catch (error: any) {
    console.error("Retell sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Retell sync route active" });
}
