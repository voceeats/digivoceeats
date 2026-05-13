import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const restaurantId = formData.get("restaurant_id") as string;

    if (!file || !restaurantId) {
      return NextResponse.json({ error: "File and restaurant_id required" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      items_extracted: 0,
      items_imported: 0,
      warnings: [],
      confidence: "high",
      categories: 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
