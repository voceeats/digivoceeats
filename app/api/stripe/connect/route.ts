import { NextRequest, NextResponse } from "next/server";
import { createRestaurantAccount, getOnboardingLink, getAccountStatus } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

// Create or get Stripe Connect account for restaurant
export async function POST(request: NextRequest) {
  try {
    const { restaurantId } = await request.json();

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    let stripeAccountId = restaurant.stripe_account_id;

    // Create new Stripe account if doesn't exist
    if (!stripeAccountId) {
      const account = await createRestaurantAccount(
        restaurantId,
        restaurant.email || `owner@${restaurant.slug}.com`,
        restaurant.name,
      );
      stripeAccountId = account.id;

      // Save to database
      await supabaseAdmin
        .from("restaurants")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", restaurantId);

      console.log(`✅ Created Stripe account for ${restaurant.name}: ${stripeAccountId}`);
    }

    // Get onboarding link
    const onboardingUrl = await getOnboardingLink(stripeAccountId, restaurantId);

    return NextResponse.json({
      success: true,
      stripe_account_id: stripeAccountId,
      onboarding_url: onboardingUrl,
    });

  } catch (error: any) {
    console.error("Stripe Connect error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Check account status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    }

    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("stripe_account_id, stripe_onboarding_complete, name")
      .eq("id", restaurantId)
      .single();

    if (!restaurant?.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        message: "No Stripe account yet",
      });
    }

    const status = await getAccountStatus(restaurant.stripe_account_id);

    // Update database if onboarding complete
    if (status.charges_enabled && !restaurant.stripe_onboarding_complete) {
      await supabaseAdmin
        .from("restaurants")
        .update({ stripe_onboarding_complete: true })
        .eq("id", restaurantId);
    }

    return NextResponse.json({
      connected: true,
      charges_enabled: status.charges_enabled,
      payouts_enabled: status.payouts_enabled,
      onboarding_complete: status.details_submitted,
      stripe_account_id: restaurant.stripe_account_id,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
