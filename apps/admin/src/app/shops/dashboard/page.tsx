import Link from "next/link";
import { Card } from "@tpt/ui/card";

export default function DashboardPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Maker Dashboard</h1>
      <p className="text-muted-foreground mb-6">
        Manage your shop, fulfillment jobs, and listings.
      </p>

      <Card className="p-6 mb-4">
        <h2 className="text-base font-semibold mb-2">Authentication Required</h2>
        <p className="text-sm text-muted-foreground">
          Dashboard requires authentication — coming in Phase 6. Once authentication is
          implemented, this page will display your shop stats, active orders,
          fulfillment job queue, and performance metrics.
        </p>
      </Card>

      <div className="flex gap-3">
        <Link
          href="/shops/onboard"
          className="text-sm underline underline-offset-4 text-primary hover:opacity-80"
        >
          Register Shop
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link
          href="/catalog"
          className="text-sm underline underline-offset-4 text-primary hover:opacity-80"
        >
          View Listings
        </Link>
      </div>
    </div>
  );
}
