import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  extractMenuFromImage,
  extractMenuFromPDF,
  validateExtractedMenu,
  generateVoiceDescription,
} from "@/lib/menu-extraction";
import { syncMenuToRetell } from "@/lib/retell";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const restaurantId = formData.get("restaurant_id") as string;
    const mode = (formData.get("mode") as string) || "replace";

    if (!file || !restaurantId) {
      return NextResponse.json({ error: "File and restaurant_id required" }, { status: 400 });
    }

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .eq("owner_id", user.id)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const fileBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(fileBuffer).toString("base64");
    const mimeType = file.type;
    const fileName = `${restaurantId}/${Date.now()}-${file.name}`;

    const { data: uploadData } = await supabaseAdmin.storage
      .from("menu-uploads")
      .upload(fileName, fileBuffer, { contentType: mimeType });

    const fileUrl = uploadData?.path
      ? supabaseAdmin.storage.from("menu-uploads").getPublicUrl(uploadData.path).data.publicUrl
      : "";

    const { data: uploadLog } = await supabaseAdmin
      .from("menu_uploads")
      .insert({
        restaurant_id: restaurantId,
        uploaded_by: user.id,
        file_url: fileUrl,
        file_type: mimeType,
        status: "processing",
      })
      .select()
      .single();

    let extracted;
    try {
      if (mimeType === "application/pdf") {
        extracted = await extractMenuFromPDF(base64);
      } else {
        extracted = await extractMenuFromImage(base64, mimeType);
      }
    } catch (error: any) {
      await supabaseAdmin
        .from("menu_uploads")
        .update({ status: "failed", error_message: error.message })
        .eq("id", uploadLog?.id);
      return NextResponse.json({ error: "Menu extraction failed: " + error.message }, { status: 500 });
    }

    const validation = validateExtractedMenu(extracted);
    if (!validation.valid) {
      await supabaseAdmin
        .from("menu_uploads")
        .update({ status: "failed", raw_extraction: extracted as any, error_message: "No valid menu items found" })
        .eq("id", uploadLog?.id);
      return NextResponse.json({ success: false, error: "Could not extract menu items", warnings: validation.warnings });
    }

    if (mode === "replace") {
      await supabaseAdmin.from("menu_items").delete().eq("restaurant_id", restaurantId);
      await supabaseAdmin.from("menu_categories").delete().eq("restaurant_id", restaurantId);
    }

    let totalImported = 0;

    for (let catIndex = 0; catIndex < extracted.categories.length; catIndex++) {
      const category = extracted.categories[catIndex];

      const { data: cat } = await supabaseAdmin
        .from("menu_categories")
        .insert({
          restaurant_id: restaurantId,
          name: category.name,
          display_order: catIndex,
          is_visible: true,
        })
        .select()
        .single();

      if (!cat) continue;

      const items = await Promise.all(
        category.items
          .filter((item) => item.name)
          .map(async (item, itemIndex) => {
            const voiceDesc = await generateVoiceDescription(
              item.name,
              item.description,
              item.price || 0
            );
            return {
              restaurant_id: restaurantId,
              category_id: cat.id,
              name: item.name,
              description: item.description,
              price: item.price || 0,
              is_available: true,
              allergens: item.allergens || [],
              calories: item.calories,
              display_order: itemIndex,
              voice_description: voiceDesc,
            };
          })
      );

      const { data: insertedItems } = await supabaseAdmin
        .from("menu_items")
        .insert(items)
        .select();

      totalImported += insertedItems?.length || 0;
    }

    await supabaseAdmin
      .from("menu_uploads")
      .update({
        status: "completed",
        raw_extraction: extracted as any,
        items_found: validation.itemCount,
        items_imported: totalImported,
      })
      .eq("id", uploadLog?.id);

    try {
      await syncMenuToRetell(restaurantId);
    } catch (error) {
      console.error("Retell sync failed (non-fatal):", error);
    }

    return NextResponse.json({
      success: true,
      items_extracted: validation.itemCount,
      items_imported: totalImported,
      warnings: validation.warnings,
      confidence: extracted.confidence,
      categories: extracted.categories.length,
      upload_id: uploadLog?.id,
    });
  } catch (error: any) {
    console.error("Menu extraction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
