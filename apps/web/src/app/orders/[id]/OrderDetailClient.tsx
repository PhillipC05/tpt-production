"use client";

import { useEffect, useState, useCallback } from "react";
import { io as connectSocket } from "socket.io-client";
import Link from "next/link";
import { Badge } from "@tpt/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const ORDER_STATUSES = ["PENDING", "ROUTED", "IN_PRODUCTION", "IN_TRANSIT", "DELIVERED"] as const;

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "secondary",
  ROUTED: "secondary",
  IN_PRODUCTION: "default",
  IN_TRANSIT: "default",
  DELIVERED: "outline",
  CANCELLED: "destructive",
};

export interface TrackingEvent {
  id: string;
  orderId: string;
  source: string;
  status: string;
  note?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  userId: string;
  status: string;
  items: Array<{
    id: string;
    orderId: string;
    listingId?: string;
    quantity: number;
    unitPrice: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  orderId: string;
  userId: string;
  initialOrder: OrderDetail;
  initialTracking: TrackingEvent[];
}

interface ToastItem {
  id: string;
  message: string;
}

export function OrderDetailClient({ orderId, userId, initialOrder, initialTracking }: Props) {
  const [order, setOrder] = useState<OrderDetail>(initialOrder);
  const [tracking, setTracking] = useState<TrackingEvent[]>(initialTracking);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const socket = connectSocket(API_URL, { transports: ["websocket", "polling"] });
    socket.emit("join-order", orderId);

    socket.on("tracking", (event: TrackingEvent) => {
      setTracking((prev) => [event, ...prev]);
      addToast(`${event.source}: ${event.status}`);
    });

    socket.on("order:status", ({ status }: { status: string }) => {
      setOrder((prev) => ({ ...prev, status }));
      addToast(`Status updated: ${status.replace(/_/g, " ")}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId, addToast]);

  const currentStep = ORDER_STATUSES.indexOf(order.status as (typeof ORDER_STATUSES)[number]);
  const isCancelled = order.status === "CANCELLED";
  const total = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <div className="container py-8 max-w-2xl">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-foreground text-background text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-right-4 duration-300"
          >
            {toast.message}
          </div>
        ))}
      </div>

      <Link
        href={userId ? `/orders?userId=${encodeURIComponent(userId)}` : "/orders"}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block"
      >
        ← Back to Orders
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Order</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">{order.id}</p>
        </div>
        <Badge variant={STATUS_COLORS[order.status] ?? "secondary"}>{order.status}</Badge>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Status Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-0">
              {ORDER_STATUSES.map((status, idx) => {
                const done = currentStep >= idx;
                const isLast = idx === ORDER_STATUSES.length - 1;
                return (
                  <div key={status} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                          done
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-background border-muted text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <p className="text-xs mt-1 text-center whitespace-nowrap">
                        {status.replace(/_/g, " ")}
                      </p>
                    </div>
                    {!isLast && (
                      <div
                        className={`h-0.5 flex-1 mx-1 ${done && currentStep > idx ? "bg-primary" : "bg-muted"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tracking events */}
      {tracking.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Tracking History</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-muted ml-2 space-y-4">
              {tracking.map((event) => (
                <li key={event.id} className="ml-4">
                  <div className="absolute w-2 h-2 bg-primary rounded-full -left-1 mt-1.5" />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{event.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.source}
                        {event.note ? ` — ${event.note}` : ""}
                      </p>
                      {(event.lat !== undefined && event.lng !== undefined) && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 font-medium">Listing</th>
                <th className="text-right py-1 font-medium">Qty</th>
                <th className="text-right py-1 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2">
                    {item.listingId ? (
                      <Link
                        href={`/catalog/${item.listingId}`}
                        className="hover:underline text-primary"
                      >
                        {item.listingId.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Custom</span>
                    )}
                  </td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">
                    NZD {(item.unitPrice * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="text-right pt-2 font-semibold">
                  Total
                </td>
                <td className="text-right pt-2 font-semibold">NZD {total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Placed: {new Date(order.createdAt).toLocaleString()}</p>
        <p>Updated: {new Date(order.updatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
