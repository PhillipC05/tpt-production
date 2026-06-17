import Link from "next/link";
import { Badge } from "@tpt/ui/badge";
import { Card, CardContent } from "@tpt/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "secondary",
  ROUTED: "secondary",
  IN_PRODUCTION: "default",
  IN_TRANSIT: "default",
  DELIVERED: "outline",
  CANCELLED: "destructive",
};

interface OrderSummary {
  id: string;
  userId: string;
  status: string;
  items: Array<{ id: string; quantity: number; unitPrice: number }>;
  createdAt: string;
}

interface OrdersResponse {
  data: OrderSummary[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

async function getOrders(userId: string, page: number): Promise<OrdersResponse | null> {
  try {
    const res = await fetch(`${API_URL}/orders?userId=${encodeURIComponent(userId)}&page=${page}&pageSize=10`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json() as OrdersResponse;
  } catch {
    return null;
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const userId = typeof params.userId === "string" ? params.userId : "";
  const page = typeof params.page === "string" ? parseInt(params.page) || 1 : 1;

  if (!userId) {
    return (
      <div className="container py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6">My Orders</h1>
        <form className="flex gap-2" method="get">
          <input
            name="userId"
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Enter your user ID"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            View Orders
          </button>
        </form>
      </div>
    );
  }

  const result = await getOrders(userId, page);
  const orders = result?.data ?? [];
  const meta = result?.meta ?? { page: 1, totalPages: 1, total: 0, pageSize: 10 };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <span className="text-sm text-muted-foreground">{meta.total} orders</span>
      </div>
      {orders.length === 0 ? (
        <p className="text-muted-foreground">No orders found.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const total = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
            return (
              <Card key={order.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/orders/${order.id}?userId=${encodeURIComponent(userId)}`}
                        className="font-medium hover:underline text-sm"
                      >
                        {order.id.slice(0, 12)}…
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item(s) ·{" "}
                        NZD {total.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant={STATUS_COLORS[order.status] ?? "secondary"}>{order.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {meta.totalPages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          {page > 1 && (
            <Link
              href={`/orders?userId=${encodeURIComponent(userId)}&page=${page - 1}`}
              className="px-3 py-1.5 border rounded text-sm hover:bg-accent"
            >
              Previous
            </Link>
          )}
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            {page} / {meta.totalPages}
          </span>
          {page < meta.totalPages && (
            <Link
              href={`/orders?userId=${encodeURIComponent(userId)}&page=${page + 1}`}
              className="px-3 py-1.5 border rounded text-sm hover:bg-accent"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
