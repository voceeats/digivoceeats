// PATH: app/pay/[orderId]/page.tsx
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

export default async function DirectPayPage({
  params,
}: {
  params: { orderId: string };
}) {
  const { orderId } = params;

  // Fetch order
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status, stripe_payment_link_url, total, restaurant_id, customer_name, items, subtotal, tax, platform_fee, restaurant_payout, customer_phone, customer_email, order_number")
    .eq("id", orderId)
    .single();

  if (!order) {
    redirect("/pay?error=not_found");
  }

  // Already paid
  if (order.payment_status === "paid" || order.payment_status === "cash_collected") {
    redirect("/pay?success=1");
  }

  // If we already have a valid Stripe URL, redirect directly
  if (order.stripe_payment_link_url) {
    redirect(order.stripe_payment_link_url);
  }

  // Generate a new Stripe session
  let checkoutUrl: string | undefined;
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const res = await fetch(`${appUrl}/api/stripe/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        successReturn: "pay",
      }),
      cache: "no-store",
    });

    const data = await res.json();
    checkoutUrl = data.checkout_url;
  } catch (e) {
    console.error("Direct pay redirect failed:", e);
  }

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  // Fallback to manual code entry
  redirect("/pay");
}
