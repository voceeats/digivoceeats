import { createClient } from "@supabase/supabase-js";

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  cuisine_type?: string;
  description?: string;
  stripe_account_id?: string;
  stripe_onboarding_complete: boolean;
  retell_agent_id?: string;
  retell_phone_number?: string;
  is_open: boolean;
  accepts_voice_orders: boolean;
  accepts_in_person: boolean;
  tax_rate: number;
  allow_sms_payment: boolean;
  allow_ivr_payment: boolean;
  allow_in_person_payment: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  display_order: number;
  is_visible: boolean;
  available_from?: string;
  available_until?: string;
  available_days: number[];
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  is_available: boolean;
  is_featured: boolean;
  track_quantity: boolean;
  quantity_remaining?: number;
  auto_disable_at_zero: boolean;
  available_from?: string;
  available_until?: string;
  image_url?: string;
  allergens: string[];
  calories?: number;
  prep_time_minutes: number;
  display_order: number;
  voice_description?: string;
  created_at: string;
  updated_at: string;
  menu_categories?: MenuCategory;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface Order {
  id: string;
  order_number: string;
  restaurant_id: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  notes?: string;
  subtotal: number;
  tax: number;
  tip: number;
  platform_fee: number;
  restaurant_payout: number;
  total: number;
  payment_method?: string;
  payment_status: string;
  stripe_payment_intent_id?: string;
  stripe_payment_link_id?: string;
  stripe_payment_link_url?: string;
  stripe_transfer_id?: string;
  status: string;
  source: string;
  retell_call_id?: string;
  created_at: string;
  accepted_at?: string;
  completed_at?: string;
  paid_at?: string;
  payment_link_sent_at?: string;
  payment_link_expires_at?: string;
}

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  stripe_customer_id?: string;
  total_orders: number;
  total_spent: number;
  noshows: number;
  preferred_payment: string;
  created_at: string;
  updated_at: string;
}

export interface Printer {
  id: string;
  restaurant_id: string;
  name: string;
  type: "browser" | "network_ip" | "star_micronics" | "epson_epos" | "usb";
  ip_address?: string;
  port: number;
  is_default: boolean;
  is_online: boolean;
  auto_print_on_accept: boolean;
  paper_width: "58mm" | "80mm";
  created_at: string;
}

export interface Notification {
  id: string;
  restaurant_id: string;
  type: string;
  title: string;
  message?: string;
  order_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface Payout {
  id: string;
  restaurant_id: string;
  order_id?: string;
  stripe_transfer_id?: string;
  amount: number;
  currency: string;
  status: string;
  arrived_at?: string;
  created_at: string;
}

// Browser client — safe to use in client components
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client — server only, bypasses RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
