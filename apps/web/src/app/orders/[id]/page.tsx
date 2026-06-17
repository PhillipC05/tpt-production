import { notFound } from "next/navigation";
import { OrderDetailClient } from "./OrderDetailClient";
import type { OrderDetail, TrackingEvent } from "./OrderDetailClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function getOrder(id: string): Promise<OrderDetail | null> {
  try {
    const res = await fetch(`${API_URL}/orders/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as OrderDetail;
  } catch {
    return null;
  }
}

async function getTracking(id: string): Promise<TrackingEvent[]> {
  try {
    const res = await fetch(`${API_URL}/orders/${id}/tracking`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as TrackingEvent[];
  } catch {
    return [];
  }
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const userId = typeof sp.userId === "string" ? sp.userId : "";

  const [order, tracking] = await Promise.all([getOrder(id), getTracking(id)]);
  if (!order) notFound();

  return (
    <OrderDetailClient
      orderId={id}
      userId={userId}
      initialOrder={order}
      initialTracking={tracking}
    />
  );
}
