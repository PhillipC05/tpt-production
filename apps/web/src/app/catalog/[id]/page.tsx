import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@tpt/ui/badge";
import { Button } from "@tpt/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";
import { AddToCartButton } from "@/components/add-to-cart-button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface DesignFile {
  id: string;
  fileKey: string;
  fileType: string;
  drmEnabled: boolean;
}

interface Listing {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  price: number;
  currency: string;
  designFiles?: DesignFile[];
}

async function getListing(id: string): Promise<Listing | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/${id}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  return (
    <div className="container py-8 max-w-3xl">
      <Link
        href="/catalog"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block"
      >
        &larr; Back to Catalog
      </Link>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <Badge variant="secondary">
              {SOURCE_TYPE_LABELS[listing.sourceType] ?? listing.sourceType}
            </Badge>
          </div>
          <p className="text-2xl font-semibold text-primary">{formatPrice(listing)}</p>
        </div>

        {/* Description */}
        {listing.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {listing.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Design files */}
        {listing.designFiles && listing.designFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Design Files</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {listing.designFiles.map((file) => (
                  <li key={file.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{file.fileKey.split("/").pop()}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{file.fileType}</Badge>
                      {file.drmEnabled && (
                        <Badge variant="secondary" className="text-xs">DRM Protected</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="flex gap-3 pt-2">
          <AddToCartButton
            listingId={listing.id}
            title={listing.title}
            price={listing.price}
            currency={listing.currency}
          />
          <Button variant="outline" size="lg" asChild>
            <Link href="/cart">View Cart</Link>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link href={`/orders/custom?listingId=${listing.id}`}>Custom Order</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
