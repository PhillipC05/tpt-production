"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@tpt/ui/button";
import { CartItem, getCart, removeFromCart, updateQuantity } from "@/lib/cart";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
    const handler = () => setItems(getCart());
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, []);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currency = items[0]?.currency ?? "NZD";

  if (items.length === 0) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <Link href="/catalog">
          <Button variant="outline">Browse Catalog</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Cart</h1>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.listingId} className="flex items-center justify-between border rounded-lg p-4">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {new Intl.NumberFormat("en-NZ", { style: "currency", currency: item.currency }).format(item.price)} each
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => updateQuantity(item.listingId, item.quantity - 1)}>
                -
              </Button>
              <span className="w-8 text-center">{item.quantity}</span>
              <Button variant="outline" size="sm" onClick={() => updateQuantity(item.listingId, item.quantity + 1)}>
                +
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.listingId)}>
                ✕
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-xl font-bold">
            {new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(total)}
          </p>
        </div>
        <Link href="/checkout">
          <Button size="lg">Proceed to Checkout</Button>
        </Link>
      </div>
    </div>
  );
}
