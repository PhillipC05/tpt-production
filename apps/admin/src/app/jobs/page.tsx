import Link from "next/link";
import { Badge } from "@tpt/ui/badge";
import { Card, CardContent } from "@tpt/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const JOB_STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "secondary",
  ACCEPTED: "default",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  FAILED: "destructive",
  CANCELLED: "destructive",
};

interface FulfillmentJob {
  id: string;
  orderId: string;
  shopId?: string;
  status: string;
  acceptedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface JobsResponse {
  data: FulfillmentJob[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

async function getJobs(shopId: string, status: string, page: number): Promise<JobsResponse | null> {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (shopId) params.set("shopId", shopId);
  if (status) params.set("status", status);
  try {
    const res = await fetch(`${API_URL}/fulfillment-jobs?${params}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as JobsResponse;
  } catch {
    return null;
  }
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const shopId = typeof sp.shopId === "string" ? sp.shopId : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = typeof sp.page === "string" ? parseInt(sp.page) || 1 : 1;

  const result = await getJobs(shopId, status, page);
  const jobs = result?.data ?? [];
  const meta = result?.meta ?? { page: 1, totalPages: 1, total: 0, pageSize: 20 };

  return (
    <div className="container py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Fulfillment Jobs</h1>

      {/* Filters */}
      <form className="flex gap-2 mb-6" method="get">
        <input
          name="shopId"
          defaultValue={shopId}
          className="border rounded px-3 py-2 text-sm w-48"
          placeholder="Shop ID"
        />
        <select
          name="status"
          defaultValue={status}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"].map((s) => (
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

      <p className="text-sm text-muted-foreground mb-4">{meta.total} jobs</p>

      {jobs.length === 0 ? (
        <p className="text-muted-foreground">No jobs found.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/jobs/${job.id}`} className="font-medium hover:underline text-sm">
                      {job.id.slice(0, 12)}…
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Order: {job.orderId.slice(0, 12)}… · Shop: {job.shopId?.slice(0, 8) ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={JOB_STATUS_COLORS[job.status] ?? "secondary"}>{job.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex gap-2 mt-6 justify-center">
          {page > 1 && (
            <Link
              href={`/jobs?shopId=${encodeURIComponent(shopId)}&status=${status}&page=${page - 1}`}
              className="px-3 py-1.5 border rounded text-sm hover:bg-accent"
            >
              Previous
            </Link>
          )}
          <span className="px-3 py-1.5 text-sm text-muted-foreground">{page} / {meta.totalPages}</span>
          {page < meta.totalPages && (
            <Link
              href={`/jobs?shopId=${encodeURIComponent(shopId)}&status=${status}&page=${page + 1}`}
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
