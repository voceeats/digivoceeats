import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurant_name, cuisine_type, owner_name, owner_email,
      owner_phone, restaurant_phone, address, city, state, zip,
      num_locations, heard_about, message,
    } = body;

    if (!restaurant_name || !owner_name || !owner_email || !owner_phone || !address || !city || !state) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error: dbError } = await supabase.from("restaurant_leads").insert({
      restaurant_name,
      cuisine_type,
      owner_name,
      owner_email,
      owner_phone,
      restaurant_phone,
      address: `${address}, ${city}, ${state} ${zip}`,
      num_locations,
      heard_about,
      message,
      status: "new",
      submitted_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("[Signup] DB error:", dbError.message);
    }

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "reports@digivoceeats.com",
      to: [process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "diginetplore@gmail.com"],
      subject: `🍽️ New Restaurant Signup — ${restaurant_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,sans-serif;color:#F9FAFB;">
          <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
            <div style="background:linear-gradient(135deg,#1a0a00,#3d1f00);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
              <p style="margin:0 0 8px;color:#b5853a;font-size:11px;letter-spacing:3px;text-transform:uppercase;">DigiVoceEats</p>
              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">New Restaurant Application 🍽️</h1>
            </div>
            <div style="background:#111118;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 16px 16px;padding:32px;">
              <div style="background:rgba(0,200,150,0.08);border:1px solid rgba(0,200,150,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
                <div style="color:#00C896;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Restaurant</div>
                <div style="font-size:22px;font-weight:700;color:#F9FAFB;margin-bottom:4px;">${restaurant_name}</div>
                <div style="color:#9CA3AF;font-size:14px;">${cuisine_type} · ${num_locations} location${Number(num_locations) > 1 ? "s" : ""}</div>
                <div style="color:#9CA3AF;font-size:14px;margin-top:4px;">📍 ${address}, ${city}, ${state} ${zip}</div>
                <div style="color:#9CA3AF;font-size:14px;margin-top:4px;">📞 ${restaurant_phone}</div>
              </div>
              <div style="background:rgba(181,133,58,0.08);border:1px solid rgba(181,133,58,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
                <div style="color:#b5853a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Owner</div>
                <div style="font-size:18px;font-weight:700;color:#F9FAFB;margin-bottom:8px;">${owner_name}</div>
                <div style="color:#9CA3AF;font-size:14px;">📧 ${owner_email}</div>
                <div style="color:#9CA3AF;font-size:14px;margin-top:4px;">📱 ${owner_phone}</div>
              </div>
              ${heard_about ? `<div style="margin-bottom:16px;"><div style="color:#6B7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">How they heard about us</div><div style="color:#D1D5DB;font-size:14px;">${heard_about}</div></div>` : ""}
              ${message ? `<div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:24px;"><div style="color:#6B7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Their Message</div><div style="color:#D1D5DB;font-size:14px;line-height:1.6;">${message}</div></div>` : ""}
              <div style="text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
                <a href="https://www.digivoceeats.com/admin" style="display:inline-block;background:linear-gradient(135deg,#b5853a,#8a5e20);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;">View in Admin Dashboard →</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "reports@digivoceeats.com",
      to: [owner_email],
      subject: `We received your application, ${owner_name.split(" ")[0]}! 🎙️`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,serif;color:#2c1a0e;">
          <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
            <div style="background:linear-gradient(135deg,#1a0a00,#3d1f00,#b5853a);border-radius:16px 16px 0 0;padding:40px;text-align:center;">
              <p style="margin:0 0 8px;color:#b5853a;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">DigiVoceEats</p>
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:400;">Application Received! 🎉</h1>
            </div>
            <div style="background:#fff;border:1px solid #ede8e0;border-top:none;border-radius:0 0 16px 16px;padding:40px;">
              <p style="color:#6b4c2a;font-size:16px;line-height:1.7;margin:0 0 24px;">Hi <strong>${owner_name.split(" ")[0]}</strong>,</p>
              <p style="color:#6b4c2a;font-size:15px;line-height:1.7;margin:0 0 24px;">Thanks for applying to join <strong>DigiVoceEats</strong>! We've received your application for <strong>${restaurant_name}</strong> and our team will be in touch within <strong>24 hours</strong>.</p>
              <div style="background:#faf7f2;border-radius:12px;padding:24px;margin-bottom:28px;border:1px solid #ede8e0;">
                <div style="color:#b5853a;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;font-family:Arial,sans-serif;">What happens next</div>
                ${["Our team reviews your application", "We call you to discuss your setup", "We configure your AI phone line", "You go live and start taking voice orders"].map((s, i) => `
                  <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
                    <div style="width:24px;height:24px;border-radius:50%;background:rgba(181,133,58,0.15);border:1px solid rgba(181,133,58,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;color:#b5853a;font-weight:700;flex-shrink:0;font-family:Arial,sans-serif;">${i + 1}</div>
                    <span style="color:#6b4c2a;font-size:14px;line-height:1.5;padding-top:2px;">${s}</span>
                  </div>`).join("")}
              </div>
              <div style="text-align:center;padding-top:20px;border-top:1px solid #ede8e0;">
                <p style="margin:0;color:#9a7a4a;font-size:12px;font-family:Arial,sans-serif;">DigiVoceEats · <a href="https://www.digivoceeats.com" style="color:#b5853a;text-decoration:none;">digivoceeats.com</a></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Restaurant Signup] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
