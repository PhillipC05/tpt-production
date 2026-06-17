import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";
import { Badge } from "@tpt/ui/badge";
import { Button, buttonVariants } from "@tpt/ui/button";
import { Input } from "@tpt/ui/input";
import { Label } from "@tpt/ui/label";

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
  page: number;
  pageSize: number;
}

interface SearchParams {
  search?: string;
  sourceType?: string;
  category?: string;
  priceMin?: string;
  priceMax?: string;
  page?: string;
}

async function getCatalog(params: SearchParams): Promise<CatalogResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.sourceType) qs.set("sourceType", params.sourceType);
  if (params.category) qs.set("category", params.category);
  if (params.priceMin) qs.set("priceMin", params.priceMin);
  if (params.priceMax) qs.set("priceMax", params.priceMax);
  qs.set("page", params.page ?? "1");
  qs.set("pageSize", "12");

  try {
    const res = await fetch(`${API_URL}/catalog?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) return { data: [], total: 0, page: 1, pageSize: 12 };
    return await res.json();
  } catch {
    return { data: [], total: 0, page: 1, pageSize: 12 };
  }
}

const SOURCE_TYPES = [
  { value: "", label: "All Sources" },
  { value: "LOCAL_PRINT", label: "Local Print" },
  { value: "OVERSEAS", label: "Overseas" },
  { value: "CUSTOM", label: "Custom" },
];

function formatPrice(listing: Listing): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: listing.currency || "NZD",
  }).format(listing.price);
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await getCatalog(params);
  const currentPage = parseInt(params.page ?? "1", 10);
  const totalPages = Math.max(1, Math.ceil(result.total / 12));

  function pageUrl(p: number) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.sourceType) qs.set("sourceType", params.sourceType);
    if (params.category) qs.set("category", params.category);
    if (params.priceMin) qs.set("priceMin", params.priceMin);
    if (params.priceMax) qs.set("priceMax", params.priceMax);
    qs.set("page", String(p));
    return `/catalog?${qs.toString()}`;
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Browse Catalog</h1>

      {/* Filters */}
      <form method="GET" action="/catalog" className="mb-8 p-4 border rounded-lg bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              name="search"
              type="text"
              placeholder="Search listings..."
              defaultValue={params.search ?? ""}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sourceType">Source Type</Label>
            <select
              id="sourceType"
              name="sourceType"
              defaultValue={params.sourceType ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="priceMin">Min Price (cents)</Label>
            <Input
              id="priceMin"
              name="priceMin"
              type="number"
              min={0}
              placeholder="0"
              defaultValue={params.priceMin ?? ""}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="priceMax">Max Price (cents)</Label>
            <Input
              id="priceMax"
              name="priceMax"
              type="number"
              min={0}
              placeholder="Any"
              defaultValue={params.priceMax ?? ""}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" className={buttonVariants()}>Apply Filters</button>
          <Button variant="outline" asChild>
            <Link href="/catalog">Clear</Link>
          </Button>
        </div>
      </form>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {result.total} listing{result.total !== 1 ? "s" : ""} found
        {currentPage > 1 ? ` — page ${currentPage} of ${totalPages}` : ""}
      </p>

      {/* Grid */}
      {result.data.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No listings match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {result.data.map((listing) => (
            <Link key={listing.id} href={`/catalog/${listing.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm line-clamp-2">{listing.title}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {SOURCE_TYPES.find((s) => s.value === listing.sourceType)?.label ?? listing.sourceType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {listing.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageUrl(currentPage - 1)}>Previous</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageUrl(currentPage + 1)}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
