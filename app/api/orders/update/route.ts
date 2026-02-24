import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateSessionToken } from "@/lib/auth/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(request: NextRequest) {
  try {
    const { orderId, userId, items, notes } = await request.json();

    if (!orderId || !userId || !items || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: orderId, userId, and at least one item",
        },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AUTH GUARD: same strategies as create
    const authHeader = request.headers.get("Authorization");
    let isAuthorized = false;

    // Strategy 1: Custom session token
    if (
      !isAuthorized &&
      authHeader &&
      authHeader !== "Bearer null" &&
      authHeader !== "Bearer undefined"
    ) {
      const token = authHeader.replace("Bearer ", "");
      if (userId && token) {
        try {
          const tokenValid = await validateSessionToken(userId, token);
          if (tokenValid) {
            isAuthorized = true;
          } else {
            const { data: userRec } = await supabase
              .from("users")
              .select("id, session_token, session_expires_at")
              .eq("id", userId)
              .single();

            if (userRec && userRec.session_token === token) {
              const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
              await supabase
                .from("users")
                .update({ session_expires_at: newExpiry })
                .eq("id", userId);
              isAuthorized = true;
            }
          }
        } catch (e) {
          console.log("Custom token validation error:", e);
        }
      }
    }

    // Strategy 2: Guest session check
    if (!isAuthorized && userId) {
      const { data: activeSession } = await supabase
        .from("guest_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (activeSession) isAuthorized = true;
    }

    // Strategy 3: Verify user exists in DB
    if (!isAuthorized && userId) {
      const { data: userRecord } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (userRecord) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 },
      );
    }

    // Verify order exists and belongs to user
    const { data: existingOrder, error: orderFetchError } = await supabase
      .from("orders")
      .select("id, user_id, status, created_at")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (orderFetchError || !existingOrder) {
      return NextResponse.json(
        { success: false, error: "Order not found or does not belong to you" },
        { status: 404 },
      );
    }

    // Check cooldown: only allow edits within 2 minutes of order creation
    const orderCreatedAt = new Date(existingOrder.created_at);
    const now = new Date();
    const timeDiffSeconds = (now.getTime() - orderCreatedAt.getTime()) / 1000;

    if (timeDiffSeconds > 120) {
      return NextResponse.json(
        { success: false, error: "Edit window has expired. Orders can only be modified within 2 minutes of placement." },
        { status: 403 },
      );
    }

    // Fetch current prices for all items
    const itemIds = items.map((item: any) => item.itemId);
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id, name, price, available")
      .in("id", itemIds);

    if (menuError || !menuItems) {
      return NextResponse.json(
        { success: false, error: "Failed to validate menu items" },
        { status: 500 },
      );
    }

    // Validate availability and calculate new total
    let serverTotal = 0;
    const validatedOrderItems = [];

    for (const item of items) {
      const menuItem = menuItems.find((m: any) => m.id === item.itemId);
      if (!menuItem) {
        return NextResponse.json(
          { success: false, error: `Item ${item.itemId} not found` },
          { status: 400 },
        );
      }
      if (!menuItem.available) {
        return NextResponse.json(
          { success: false, error: `${menuItem.name} is currently unavailable` },
          { status: 400 },
        );
      }

      const itemTotal = menuItem.price * item.quantity;
      serverTotal += itemTotal;

      validatedOrderItems.push({
        order_id: orderId,
        menu_item_id: item.itemId,
        quantity: item.quantity,
        price: menuItem.price,
      });
    }

    // Delete existing order items
    const { error: deleteError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (deleteError) {
      console.error("Failed to delete existing order items:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to update order items" },
        { status: 500 },
      );
    }

    // Insert new order items
    const { error: insertError } = await supabase
      .from("order_items")
      .insert(validatedOrderItems);

    if (insertError) {
      console.error("Failed to insert updated order items:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to update order items" },
        { status: 500 },
      );
    }

    // Update order total and notes
    const updateFields: any = { total: serverTotal };
    if (notes !== undefined) updateFields.notes = notes;

    const { error: updateError } = await supabase
      .from("orders")
      .update(updateFields)
      .eq("id", orderId);

    if (updateError) {
      console.error("Failed to update order total:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update order total" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      orderId: orderId,
      total: serverTotal,
      message: "Order updated successfully",
    });
  } catch (error: any) {
    console.error("Order update API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
