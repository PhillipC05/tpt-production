"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CartItem, getCart, clearCart } from "@/lib/cart";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const USER_ID_KEY = "tpt-userId";

type Flags = {
  ENABLE_FREE_ECONOMY?: boolean;
  ENABLE_CREDITS?: boolean;
  ENABLE_PAYMENTS?: boolean;
};

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flags>({});
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [useCredits, setUseCredits] = useState(false);

  useEffect(() => {
    setItems(getCart());
    const storedId = localStorage.getItem(USER_ID_KEY) ?? "";
    setUserId(storedId);

    fetch(`${API_URL}/flags`)
      .then((r) => r.json() as Promise<Flags>)
      .then(setFlags)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!flags.ENABLE_CREDITS || !userId.trim()) return;
    fetch(`${API_URL}/credits/balance?userId=${encodeURIComponent(userId.trim())}`)
      .then((r) => r.json() as Promise<{ balance: number }>)
      .then((d) => setCreditBalance(d.balance))
      .catch(() => setCreditBalance(null));
  }, [userId, flags.ENABLE_CREDITS]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const currency = items[0]?.currency ?? "NZD";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(n);

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) { setError("User ID is required"); return; }
    if (items.length === 0) { setError("Cart is empty"); return; }
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem(USER_ID_KEY, userId.trim());
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          items: items.map((i) => ({
            listingId: i.listingId,
            quantity: i.quantity,
            unitPrice: i.price,
          })),
          useCredits,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const order = await res.json() as { id: string };
      clearCart();
      router.push(`/orders/${order.id}?userId=${encodeURIComponent(userId.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
      setLoading(false);
    }
  }

  async function handleStripeCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) { setError("User ID is required"); return; }
    if (items.length === 0) { setError("Cart is empty"); return; }
    setLoading(true);
    setError(null);
    try {
      localStorage.setItem(USER_ID_KEY, userId.trim());
      const orderRes = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          items: items.map((i) => ({
            listingId: i.listingId,
            quantity: i.quantity,
            unitPrice: i.price,
          })),
          useCredits: false,
        }),
      });
      if (!orderRes.ok) throw new Error(await orderRes.text());
      const order = await orderRes.json() as { id: string };

      const base = window.location.origin;
      const sessionRes = await fetch(`${API_URL}/payments/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          successUrl: `${base}/orders/${order.id}?userId=${encodeURIComponent(userId.trim())}&paid=true`,
          cancelUrl: `${base}/checkout?cancelled=true`,
        }),
      });
      if (!sessionRes.ok) throw new Error(await sessionRes.text());
      const { url } = await sessionRes.json() as { url: string };
      clearCart();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start payment");
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Checkout</h1>
        <p className="text-muted-foreground">Your cart is empty.</p>
      </div>
    );
  }

  const isFree = flags.ENABLE_FREE_ECONOMY || total === 0;

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <form onSubmit={isFree || (flags.ENABLE_CREDITS && useCredits) ? handlePlaceOrder : (flags.ENABLE_PAYMENTS ? handleStripeCheckout : handlePlaceOrder)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Your Details</CardTitle></CardHeader>
          <CardContent>
            <label className="block text-sm font-medium mb-1" htmlFor="userId">User ID</label>
            <input
              id="userId"
              className="w-full border rounded px-3 py-2 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.listingId} className="flex justify-between text-sm">
                  <span>{item.title} × {item.quantity}</span>
                  <span>{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>{isFree ? <span className="text-green-600">Free</span> : fmt(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isFree && flags.ENABLE_CREDITS && creditBalance !== null && (
          <Card>
            <CardHeader><CardTitle>Credits</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Balance: <span className="font-medium">{fmt(creditBalance)}</span>
              </p>
              {creditBalance >= total && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCredits}
                    onChange={(e) => setUseCredits(e.target.checked)}
                  />
                  Pay with credits ({fmt(total)})
                </label>
              )}
              {creditBalance < total && (
                <p className="text-xs text-muted-foreground">Insufficient credits to cover this order.</p>
              )}
            </CardContent>
          </Card>
        )}

        {!isFree && flags.ENABLE_PAYMENTS && !useCredits && (
          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You will be redirected to Stripe to complete your payment of {fmt(total)}.
              </p>
            </CardContent>
          </Card>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-md h-9 px-4 py-2 text-sm font-medium transition-colors"
        >
          {loading
            ? "Processing…"
            : isFree
            ? "Place Order (Free)"
            : useCredits
            ? "Pay with Credits"
            : flags.ENABLE_PAYMENTS
            ? "Pay with Stripe"
            : "Place Order"}
        </button>
      </form>
    </div>
  );
}
