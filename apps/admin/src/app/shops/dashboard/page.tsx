import Link from "next/link";
import { Badge } from "@tpt/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";

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
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

interface CapacityResponse {
  shopId: string;
  availableCapacity: number;
  currentJobs: number;
  maxCapacity: number;
}

async function getJobsByStatus(shopId: string, status: string): Promise<JobsResponse | null> {
  const params = new URLSearchParams({ shopId, status, pageSize: "5" });
  try {
    const res = await fetch(`${API_URL}/fulfillment-jobs?${params}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as JobsResponse;
  } catch {
    return null;
  }
}

async function getCapacity(shopId: string): Promise<CapacityResponse | null> {
  try {
    const res = await fetch(`${API_URL}/shops/${encodeURIComponent(shopId)}/capacity`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json() as CapacityResponse;
  } catch {
    return null;
  }
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const shopId = typeof sp.shopId === "string" ? sp.shopId.trim() : "";

  if (!shopId) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold mb-2">Maker Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Enter your Shop ID to view your dashboard.
        </p>
        <Card className="p-6">
          <form method="get" className="flex gap-2">
            <input
              name="shopId"
              required
              className="flex-1 border rounded px-3 py-2 text-sm"
              placeholder="Shop ID (UUID)"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Open Dashboard
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            Don&apos;t have a shop yet?{" "}
            <Link href="/shops/onboard" className="text-primary hover:underline">
              Register your shop
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  const [pendingRes, activeRes, completedRes, capacity] = await Promise.all([
    getJobsByStatus(shopId, "PENDING"),
    getJobsByStatus(shopId, "IN_PROGRESS"),
    getJobsByStatus(shopId, "COMPLETED"),
    getCapacity(shopId),
  ]);

  const pendingJobs = pendingRes?.data ?? [];
  const activeJobs = activeRes?.data ?? [];
  const recentCompleted = completedRes?.data ?? [];

  const pendingTotal = pendingRes?.meta.total ?? 0;
  const activeTotal = activeRes?.meta.total ?? 0;
  const completedTotal = completedRes?.meta.total ?? 0;

  const utilisation =
    capacity && capacity.maxCapacity > 0
      ? Math.round((capacity.currentJobs / capacity.maxCapacity) * 100)
      : null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Maker Dashboard</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Shop {shopId}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/jobs?shopId=${encodeURIComponent(shopId)}`}
            className="text-sm text-primary hover:underline"
          >
            All Jobs
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/shops/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            Switch Shop
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Pending Jobs" value={pendingTotal} sub="awaiting acceptance" />
        <StatCard label="In Progress" value={activeTotal} sub="currently running" />
        <StatCard label="Completed" value={completedTotal} sub="all time" />
        {capacity ? (
          <StatCard
            label="Capacity"
            value={utilisation !== null ? `${utilisation}%` : "—"}
            sub={`${capacity.availableCapacity} / ${capacity.maxCapacity} slots free`}
          />
        ) : (
          <StatCard label="Capacity" value="—" sub="unavailable" />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending jobs — need action */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Pending Jobs
              {pendingTotal > 5 && (
                <Link
                  href={`/jobs?shopId=${encodeURIComponent(shopId)}&status=PENDING`}
                  className="text-xs font-normal text-primary hover:underline"
                >
                  View all {pendingTotal}
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending jobs.</p>
            ) : (
              <div className="space-y-2">
                {pendingJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link href={`/jobs/${job.id}`} className="font-mono hover:underline text-xs">
                        {job.id.slice(0, 12)}…
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded px-2 py-1"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active jobs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              In Progress
              {activeTotal > 5 && (
                <Link
                  href={`/jobs?shopId=${encodeURIComponent(shopId)}&status=IN_PROGRESS`}
                  className="text-xs font-normal text-primary hover:underline"
                >
                  View all {activeTotal}
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs in progress.</p>
            ) : (
              <div className="space-y-2">
                {activeJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link href={`/jobs/${job.id}`} className="font-mono hover:underline text-xs">
                        {job.id.slice(0, 12)}…
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Accepted {job.acceptedAt ? new Date(job.acceptedAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <Badge variant="default">IN_PROGRESS</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent completions */}
      {recentCompleted.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Recently Completed
              <Link
                href={`/jobs?shopId=${encodeURIComponent(shopId)}&status=COMPLETED`}
                className="text-xs font-normal text-primary hover:underline"
              >
                View all
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentCompleted.map((job) => (
                <div key={job.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/jobs/${job.id}`} className="font-mono hover:underline text-xs">
                      {job.id.slice(0, 12)}…
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Completed {job.completedAt ? new Date(job.completedAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Badge variant={JOB_STATUS_COLORS[job.status] ?? "secondary"}>{job.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="flex gap-4 mt-8 text-sm">
        <Link href="/catalog/new" className="text-primary hover:underline">
          Create Listing
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/catalog" className="text-primary hover:underline">
          Browse Catalog
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/shops/onboard" className="text-primary hover:underline">
          Register Another Shop
        </Link>
      </div>
    </div>
  );
}
