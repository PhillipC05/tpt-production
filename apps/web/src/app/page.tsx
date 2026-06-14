import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";
import { Badge } from "@tpt/ui/badge";
import { Button } from "@tpt/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  price: number;
  currency: string;
}

interface CatalogResponse {
  data: Listing[];
  total: number;
}

async function getFeaturedListings(): Promise<Listing[]> {
  try {
    const res = await fetch(`${API_URL}/catalog?pageSize=6`, { cache: "no-store" });
    if (!res.ok) return [];
    const json: CatalogResponse = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  LOCAL_PRINT: "Local Print",
  OVERSEAS: "Overseas",
  CUSTOM: "Custom",
};

function formatPrice(listing: Listing): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: listing.currency || "NZD",
  }).format(listing.price);
}

export default async function HomePage() {
  const listings = await getFeaturedListings();

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-muted/40">
        <div className="container py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            On-demand 3D printing, fulfilled automatically
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Browse thousands of designs printed and shipped by local makers, or
            upload your own file for a custom quote.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/catalog">Browse Catalog</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/orders/custom">Request Custom Order</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Category chips */}
      <section className="border-b">
        <div className="container py-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground mr-1">Filter by source:</span>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={`/catalog?sourceType=${value}`}
              className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured listings */}
      <section className="container py-10">
        <h2 className="text-xl font-semibold mb-6">Featured Listings</h2>
        {listings.length === 0 ? (
          <p className="text-muted-foreground">No listings available right now. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <Link key={listing.id} href={`/catalog/${listing.id}`} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-2">{listing.title}</CardTitle>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {SOURCE_TYPE_LABELS[listing.sourceType] ?? listing.sourceType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {listing.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {listing.description}
                      </p>
                    )}
                    <p className="text-sm font-semibold">{formatPrice(listing)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
