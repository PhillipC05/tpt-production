"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@tpt/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";
import { Button } from "@tpt/ui/button";

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
  updatedAt: string;
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<FulfillmentJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchJob() {
    try {
      const res = await fetch(`${API_URL}/fulfillment-jobs/${params.id}`);
      if (!res.ok) throw new Error("Job not found");
      setJob(await res.json() as FulfillmentJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchJob(); }, []);

  async function performAction(action: "accept" | "complete" | "reject") {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/fulfillment-jobs/${params.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      setJob(await res.json() as FulfillmentJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="container py-16 text-center text-muted-foreground">Loading…</div>;
  if (!job) return <div className="container py-16 text-center text-destructive">{error ?? "Job not found"}</div>;

  return (
    <div className="container py-8 max-w-2xl">
      <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">
        ← Back to Jobs
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Job</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">{job.id}</p>
        </div>
        <Badge variant={JOB_STATUS_COLORS[job.status] ?? "secondary"}>{job.status}</Badge>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order</span>
            <span className="font-mono">{job.orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shop</span>
            <span className="font-mono">{job.shopId ?? "—"}</span>
          </div>
          {job.acceptedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accepted</span>
              <span>{new Date(job.acceptedAt).toLocaleString()}</span>
            </div>
          )}
          {job.completedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span>{new Date(job.completedAt).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(job.createdAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3">
        {job.status === "PENDING" && (
          <>
            <Button
              onClick={() => void performAction("accept")}
              variant="default"
            >
              {actionLoading ? "…" : "Accept"}
            </Button>
            <Button
              onClick={() => void performAction("reject")}
              variant="destructive"
            >
              {actionLoading ? "…" : "Reject"}
            </Button>
          </>
        )}
        {(job.status === "ACCEPTED" || job.status === "IN_PROGRESS") && (
          <Button
            onClick={() => void performAction("complete")}
            variant="default"
          >
            {actionLoading ? "…" : "Mark Complete"}
          </Button>
        )}
        {["COMPLETED", "FAILED", "CANCELLED"].includes(job.status) && (
          <p className="text-sm text-muted-foreground">No actions available.</p>
        )}
      </div>
    </div>
  );
}
