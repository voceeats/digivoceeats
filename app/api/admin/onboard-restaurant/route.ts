import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const RETELL_API_KEY = process.env.RETELL_API_KEY!;
const RETELL_BASE = "https://api.retellai.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

async function createRetellLLM(): Promise<string> {
  const res = await fetch(`${RETELL_BASE}/create-retell-llm`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      general_prompt: "You are Chloe, an AI order taker. Menu will be synced shortly.",
      general_tools: [
        {
          type: "end_call",
          name: "end_call",
          description: "End the call when done",
        },
      ],
    }),
  });
  const data = await res.json();
  if (!data.llm_id) throw new Error(`Failed to create LLM: ${JSON.stringify(data)}`);
  return data.llm_id;
}

async function createRetellAgent(
  restaurantName: string,
  llmId: string
): Promise<string> {
  const res = await fetch(`${RETELL_BASE}/create-agent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_name: `${restaurantName} - DigiVoceEats`,
      response_engine: {
        type: "retell-llm",
        llm_id: llmId,
      },
      voice_id: "11labs-Chloe",
      language: "en-US",
      webhook_url: `${APP_URL}/api/retell/webhook`,
      interruption_sensitivity: 0.3,
      end_call_after_silence_ms: 600000,
      max_call_duration_ms: 900000,
    }),
  });
  const data = await res.json();
  if (!data.agent_id) throw new Error(`Failed to create agent: ${JSON.stringify(data)}`);
  return data.agent_id;
}

async function purchaseRetellPhoneNumber(agentId: string): Promise<string> {
  const res = await fetch(`${RETELL_BASE}/create-phone-number`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      area_code: "703",
      inbound_agent_id: agentId,
    }),
  });
  const data = await res.json();
  if (!data.phone_number) throw new Error(`Failed to purchase number: ${JSON.stringify(data)}`);
  return data.phone_number;
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin
    const body = await req.json();
    const { leadId, ownerEmail, ownerName, restaurantName, phone, address, taxRate = 0.06 } = body;

    if (!leadId || !ownerEmail || !restaurantName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Step 1 — Create Supabase auth user
    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError && !authError.message.includes("already been registered")) {
      throw new Error(`Auth user creation failed: ${authError.message}`);
    }

    const userId = authData?.user?.id || (
      await supabase.auth.admin.listUsers()
        .then(({ data }) => data.users.find(u => u.email === ownerEmail)?.id)
    );

    if (!userId) throw new Error("Could not get user ID");

    // Step 2 — Create Retell LLM
    const llmId = await createRetellLLM();

    // Step 3 — Create Retell Agent
    const agentId = await createRetellAgent(restaurantName, llmId);

    // Step 4 — Purchase phone number
    const retellPhone = await purchaseRetellPhoneNumber(agentId);

    // Step 5 — Create restaurant in Supabase
    const slug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .insert({
        name: restaurantName,
        slug: `${slug}-${Date.now()}`,
        phone: phone || retellPhone,
        address,
        owner_id: userId,
        email: ownerEmail,
        is_open: true,
        tax_rate: taxRate,
        retell_agent_id: agentId,
        retell_phone_number: retellPhone,
      })
      .select("id")
      .single();

    if (restError) throw new Error(`Restaurant creation failed: ${restError.message}`);

    // Step 6 — Update lead status
    await supabase
      .from("restaurant_leads")
      .update({ status: "setup" })
      .eq("id", leadId);

    // Step 7 — Send welcome email
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "reports@digivoceeats.com",
      to: [ownerEmail],
      subject: `Welcome to DigiVoceEats! Your AI phone line is ready 🎙️`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,serif;color:#2c1a0e;">
          <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
            <div style="background:linear-gradient(135deg,#1a0a00,#3d1f00,#b5853a);border-radius:16px 16px 0 0;padding:40px;text-align:center;">
              <p style="margin:0 0 8px;color:#b5853a;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">DigiVoceEats</p>
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:400;">You're Live! 🎉</h1>
            </div>
            <div style="background:#fff;border:1px solid #ede8e0;border-top:none;border-radius:0 0 16px 16px;padding:40px;">
              <p style="color:#6b4c2a;font-size:16px;line-height:1.7;margin:0 0 24px;">
                Hi <strong>${ownerName}</strong>,
              </p>
              <p style="color:#6b4c2a;font-size:15px;line-height:1.7;margin:0 0 24px;">
                Your AI voice ordering system for <strong>${restaurantName}</strong> is ready! Here are your details:
              </p>

              <div style="background:#faf7f2;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #ede8e0;">
                <div style="color:#b5853a;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;font-family:Arial,sans-serif;">Your AI Phone Line</div>
                <div style="font-size:32px;font-weight:700;color:#1a0a00;letter-spacing:2px;margin-bottom:8px;font-family:Arial,sans-serif;">${retellPhone}</div>
                <div style="color:#6b4c2a;font-size:13px;">Customers call this number to place orders with Chloe, your AI assistant.</div>
              </div>

              <div style="background:#faf7f2;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #ede8e0;">
                <div style="color:#b5853a;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;font-family:Arial,sans-serif;">Dashboard Login</div>
                <div style="margin-bottom:8px;font-size:14px;color:#6b4c2a;">
                  <strong>URL:</strong> <a href="${APP_URL}/dashboard" style="color:#b5853a;">${APP_URL}/dashboard</a>
                </div>
                <div style="margin-bottom:8px;font-size:14px;color:#6b4c2a;">
                  <strong>Email:</strong> ${ownerEmail}
                </div>
                <div style="font-size:14px;color:#6b4c2a;">
                  <strong>Temporary Password:</strong> <span style="font-family:monospace;background:#f0ede8;padding:2px 8px;border-radius:4px;">${tempPassword}</span>
                </div>
                <div style="margin-top:12px;color:#9a7a4a;font-size:12px;">Please change your password after first login.</div>
              </div>

              <div style="background:#faf7f2;border-radius:12px;padding:24px;margin-bottom:28px;border:1px solid #ede8e0;">
                <div style="color:#b5853a;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;font-family:Arial,sans-serif;">Next Steps</div>
                ${["Log into your dashboard", "Add your menu items and prices", "Set your opening hours", "Your AI phone line is already live!"].map((s, i) => `
                  <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
                    <div style="width:24px;height:24px;border-radius:50%;background:rgba(181,133,58,0.15);border:1px solid rgba(181,133,58,0.3);text-align:center;line-height:24px;font-size:11px;color:#b5853a;font-weight:700;flex-shrink:0;font-family:Arial,sans-serif;">${i + 1}</div>
                    <span style="color:#6b4c2a;font-size:14px;line-height:1.5;padding-top:2px;">${s}</span>
                  </div>`).join("")}
              </div>

              <div style="text-align:center;">
                <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#b5853a,#8a5e20);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;font-family:Arial,sans-serif;">
                  Go to Dashboard →
                </a>
              </div>

              <div style="text-align:center;padding-top:24px;border-top:1px solid #ede8e0;margin-top:28px;">
                <p style="margin:0;color:#9a7a4a;font-size:12px;font-family:Arial,sans-serif;">
                  Questions? Reply to this email — we're here to help.<br>
                  <a href="${APP_URL}" style="color:#b5853a;text-decoration:none;">digivoceeats.com</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ Restaurant onboarded: ${restaurantName} | Agent: ${agentId} | Phone: ${retellPhone}`);

    return NextResponse.json({
      success: true,
      restaurantId: restaurant.id,
      agentId,
      llmId,
      phone: retellPhone,
      message: `${restaurantName} is now live with phone ${retellPhone}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Onboard Restaurant] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
