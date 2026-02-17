import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateSessionToken } from "@/lib/auth/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      phone,
      items,
      tableName,
      numGuests,
      locationType,
      notes,
      sessionId,
    } = await request.json();

    const hasRegularStaffMeal = notes === "REGULAR_STAFF_MEAL";

    if (!tableName || !userId || (!hasRegularStaffMeal && (!items || items.length === 0))) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, tableName, and at least one item",
        },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AUTH GUARD: Two modes of authentication
    // 1. Supabase auth token (for staff/riders)
    // 2. Session-based auth (for guests)
    const authHeader = request.headers.get("Authorization");
    let isAuthorized = false;

    if (
      authHeader &&
      authHeader !== "Bearer null" &&
      authHeader !== "Bearer undefined"
    ) {
      const token = authHeader.replace("Bearer ", "");

      // First try: Validate as custom session token (PIN-based auth)
      if (userId && await validateSessionToken(userId, token)) {
        isAuthorized = true;
      }

      // Second try: Validate as Supabase auth token
      if (!isAuthorized) {
        const {
          data: { user: requester },
          error: authError,
        } = await supabase.auth.getUser(token);

        if (!authError && requester && requester.id === userId) {
          isAuthorized = true;
        }
      }
    }

    // If not authorized via token, check if this is a valid guest with active session
    if (!isAuthorized && sessionId) {
      const { data: session } = await supabase
        .from("guest_sessions")
        .select("id, user_id, status")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (session) {
        isAuthorized = true;
      }
    }

    // Final fallback: check if the user has ANY active guest session (handles missing sessionId)
    if (!isAuthorized && userId) {
      const { data: activeSession } = await supabase
        .from("guest_sessions")
        .select("id, user_id, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (activeSession) {
        isAuthorized = true;
      }
    }

    // Last resort: verify the user exists and has a valid session_token in the DB
    if (!isAuthorized && userId) {
      const { data: userRecord } = await supabase
        .from("users")
        .select("id, session_token, session_expires_at")
        .eq("id", userId)
        .single();

      if (
        userRecord &&
        userRecord.session_token &&
        userRecord.session_expires_at &&
        new Date(userRecord.session_expires_at) > new Date()
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.warn(
        `Order creation blocked: Unauthorized attempt for userId ${userId}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: User mismatch or invalid session",
        },
        { status: 403 },
      );
    }

    // 1. Fetch user profile and normalize role
    const { data: userData } = await supabase
      .from("users")
      .select("name, email, role")
      .eq("id", userId)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const rawRole = (userData?.role || "").toUpperCase();
    const normalizedRole = rawRole === "KITCHEN_MANAGER"
      ? "KITCHEN"
      : rawRole === "GUEST"
        ? "OUTSIDER"
        : rawRole;

    if (hasRegularStaffMeal && normalizedRole !== "STAFF") {
      return NextResponse.json(
        { success: false, error: "Regular Staff Meal is available to STAFF only" },
        { status: 403 },
      );
    }

    // 2. Fetch current prices for all DB-backed items
    const itemIds = Array.isArray(items) ? items.map((item: any) => item.itemId) : [];
    let menuItems: any[] = [];

    if (itemIds.length > 0) {
      const { data: fetchedItems, error: menuError } = await supabase
        .from("menu_items")
        .select("id, name, price, available")
        .in("id", itemIds);

      if (menuError || !fetchedItems) {
        console.error("Menu items fetch error:", menuError);
        return NextResponse.json(
          { success: false, error: "Failed to validate menu items" },
          { status: 500 },
        );
      }

      menuItems = fetchedItems;
    }

    // 3. Validate availability and calculate total
    let serverTotal = 0;
    const validatedOrderItems = [];

    for (const item of Array.isArray(items) ? items : []) {
      const menuItem = menuItems.find((m) => m.id === item.itemId);
      if (!menuItem) {
        return NextResponse.json(
          { success: false, error: `Item ${item.itemId} not found` },
          { status: 400 },
        );
      }
      if (!menuItem.available) {
        return NextResponse.json(
          {
            success: false,
            error: `Item ${item.itemId} is currently unavailable`,
          },
          { status: 400 },
        );
      }

      const itemTotal = menuItem.price * item.quantity;
      serverTotal += itemTotal;

      validatedOrderItems.push({
        menu_item_id: item.itemId,
        quantity: item.quantity,
        price: menuItem.price, // Use DB price, not client price
      });
    }

    // 4. Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        // Populate guest_info for legacy visibility in DB dashboard
        guest_info:
          normalizedRole === "OUTSIDER"
            ? { name: userData.name, email: userData.email }
            : null,
        table_name: tableName,
        location_type: locationType,
        num_guests: numGuests,
        total: serverTotal,
        notes: notes,
        session_id: sessionId,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      return NextResponse.json(
        { success: false, error: "Failed to create order" },
        { status: 500 },
      );
    }

    // 5. Create order items
    const orderItemsToInsert = validatedOrderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    if (orderItemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsToInsert);

      if (itemsError) {
        console.error("Order items insertion error:", itemsError);
        return NextResponse.json(
          { success: false, error: "Failed to insert order items" },
          { status: 500 },
        );
      }
    }

    // 5. Send Email Summary (Asynchronous)
    if (userData?.email) {
      // Import dynamically to avoid top-level issues if needed, but standard import is fine
      const { sendEmail } = require("@/lib/utils/email");

      const itemsListHtml = items
        .map((item: any) => {
          const menuItem = menuItems.find((m) => m.id === item.itemId);
          return `<li>${menuItem?.name || "Item"} x ${item.quantity} - ₹${(menuItem?.price || 0) * item.quantity}</li>`;
        })
        .join("");

      sendEmail({
        to: userData.email,
        subject: `Order Confirmed: ${tableName} - Ai Cavalli`,
        html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2 style="color: #c0272d;">Grazie, ${userData.name}!</h2>
                        <p>Your order for <strong>Table ${tableName}</strong> has been received and is being prepared.</p>
                        <hr />
                        <ul>${itemsListHtml}</ul>
                        <p><strong>Total: ₹${serverTotal}</strong></p>
                        <p style="font-size: 12px; color: #666;">This is an automated summary of your order at Ai Cavalli.</p>
                    </div>
                `,
      }).catch((err: any) => console.error("Failed to send order email:", err));
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      total: serverTotal,
      message: "Order created successfully",
    });
  } catch (error: any) {
    console.error("Secure order API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
