import Link from "next/link";
import { Badge } from "@tpt/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";

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
  items: Array<{ quantity: number; unitPrice: number }>;
  createdAt: string;
}

interface RoutingDecision {
  id: string;
  orderId: string;
  shopId?: string;
  geoScore: number;
  costScore: number;
  capacityScore: number;
  capabilityScore: number;
  totalScore: number;
  chosen: boolean;
  createdAt: string;
}

interface OrdersResponse {
  data: OrderSummary[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface RoutingResponse {
  data: RoutingDecision[];
  meta: { total: number };
}

async function getAllOrders(status: string, page: number): Promise<OrdersResponse | null> {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) params.set("status", status);
  try {
    const res = await fetch(`${API_URL}/admin/orders?${params}`, {
      cache: "no-store",
      headers: { "x-admin-secret": process.env.ADMIN_SECRET ?? "" },
    });
    if (!res.ok) return null;
    return await res.json() as OrdersResponse;
  } catch {
    return null;
  }
}

async function getRoutingDecisions(orderId: string): Promise<RoutingDecision[]> {
  try {
    const res = await fetch(`${API_URL}/admin/routing-decisions?orderId=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
      headers: { "x-admin-secret": process.env.ADMIN_SECRET ?? "" },
    });
    if (!res.ok) return [];
    const data = await res.json() as RoutingResponse;
    return data.data;
  } catch {
    return [];
  }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = typeof sp.page === "string" ? parseInt(sp.page) || 1 : 1;
  const viewOrderId = typeof sp.orderId === "string" ? sp.orderId : "";

  const [result, routingDecisions] = await Promise.all([
    getAllOrders(status, page),
    viewOrderId ? getRoutingDecisions(viewOrderId) : Promise.resolve([]),
  ]);

  const orders = result?.data ?? [];
  const meta = result?.meta ?? { page: 1, totalPages: 1, total: 0, pageSize: 20 };

  return (
    <div className="container py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">All Orders</h1>

      {/* Filters */}
      <form className="flex gap-2 mb-6" method="get">
        <select
          name="status"
          defaultValue={status}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {["PENDING", "ROUTED", "IN_PRODUCTION", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Filter
        </button>
      </form>

      <p className="text-sm text-muted-foreground mb-4">{meta.total} orders</p>

      {orders.length === 0 ? (
        <p className="text-muted-foreground">No orders found.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const total = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
            return (
              <Card key={order.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm font-mono">{order.id}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        User: {order.userId.slice(0, 8)}… · {order.items.length} item(s) · NZD {total.toFixed(2)} · {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_COLORS[order.status] ?? "secondary"}>{order.status}</Badge>
                      <Link
                        href={`/admin/orders?status=${status}&orderId=${order.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Routing
                      </Link>
                    </div>
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
              href={`/admin/orders?status=${status}&page=${page - 1}`}
              className="px-3 py-1.5 border rounded text-sm hover:bg-accent"
            >
              Previous
            </Link>
          )}
          <span className="px-3 py-1.5 text-sm text-muted-foreground">{page} / {meta.totalPages}</span>
          {page < meta.totalPages && (
            <Link
              href={`/admin/orders?status=${status}&page=${page + 1}`}
              className="px-3 py-1.5 border rounded text-sm hover:bg-accent"
            >
              Next
            </Link>
          )}
        </div>
      )}

      {/* Routing decisions panel */}
      {viewOrderId && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-sm">Routing Decisions for {viewOrderId}</CardTitle>
          </CardHeader>
          <CardContent>
            {routingDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No routing decisions found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 font-medium">Shop</th>
                    <th className="text-right py-1 font-medium">Geo</th>
                    <th className="text-right py-1 font-medium">Cost</th>
                    <th className="text-right py-1 font-medium">Cap.</th>
                    <th className="text-right py-1 font-medium">Capab.</th>
                    <th className="text-right py-1 font-medium">Total</th>
                    <th className="text-center py-1 font-medium">Chosen</th>
                  </tr>
                </thead>
                <tbody>
                  {routingDecisions.map((d) => (
                    <tr key={d.id} className={`border-b last:border-0 ${d.chosen ? "bg-primary/5" : ""}`}>
                      <td className="py-2 font-mono text-xs">{d.shopId?.slice(0, 8) ?? "—"}</td>
                      <td className="text-right py-2">{d.geoScore.toFixed(2)}</td>
                      <td className="text-right py-2">{d.costScore.toFixed(2)}</td>
                      <td className="text-right py-2">{d.capacityScore.toFixed(2)}</td>
                      <td className="text-right py-2">{d.capabilityScore.toFixed(2)}</td>
                      <td className="text-right py-2 font-semibold">{d.totalScore.toFixed(2)}</td>
                      <td className="text-center py-2">{d.chosen ? "✓" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
