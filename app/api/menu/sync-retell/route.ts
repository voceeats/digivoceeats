import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  buildRetellOrderFlowPrompt,
  mergeRetellGeneralTools,
} from "@/lib/retell";

const RETELL_BASE = "https://api.retellai.com";

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

    const byCategory: Record<string, typeof items> = {};
    items.forEach((item) => {
      const cat = (item.menu_categories as { name?: string })?.name || "Other";
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

    const prompt = buildRetellOrderFlowPrompt({
      restaurantName: restaurant.name,
      restaurantId,
      menuText,
      taxPct,
      phone: restaurant.phone || undefined,
    });

    const general_tools = mergeRetellGeneralTools(
      llmExisting.general_tools,
      appUrl,
      restaurantId,
    );

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Retell sync failed";
    console.error("Retell sync error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Retell sync active" });
}
