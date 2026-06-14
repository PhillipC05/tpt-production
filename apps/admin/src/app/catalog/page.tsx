"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@tpt/ui/button";
import { Badge } from "@tpt/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tpt/ui/table";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface Listing {
  id: string;
  title: string;
  category?: string | null;
  sourceType: string;
  price?: number | null;
  currency?: string | null;
  isActive: boolean;
}

export default function CatalogPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadListings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/catalog?pageSize=50`);
      if (!res.ok) throw new Error(`Failed to load listings (${res.status})`);
      const data = await res.json();
      setListings(data.listings ?? data.items ?? data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

  async function handleDeactivate(id: string, title: string) {
    if (!confirm(`Deactivate listing "${title}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE}/catalog/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.message ?? `Failed to deactivate (${res.status})`);
        return;
      }
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Listings</h1>
        <Link href="/catalog/new">
          <Button size="sm">New Listing</Button>
        </Link>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading listings...</p>}

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <p className="text-sm text-muted-foreground">No listings found.</p>
      )}

      {!loading && listings.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Source Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell className="font-medium">{listing.title}</TableCell>
                <TableCell>{listing.category ?? "—"}</TableCell>
                <TableCell>{listing.sourceType}</TableCell>
                <TableCell>
                  {listing.price != null
                    ? `${listing.currency ?? "NZD"} ${listing.price.toFixed(2)}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={listing.isActive ? "default" : "secondary"}>
                    {listing.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/catalog/${listing.id}/edit`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    {listing.isActive && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeactivate(listing.id, listing.title)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
