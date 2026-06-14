"use client";

import { useState } from "react";
import { Button } from "@tpt/ui/button";
import { Input } from "@tpt/ui/input";
import { Label } from "@tpt/ui/label";
import { Card } from "@tpt/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tpt/ui/select";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const SOURCE_TYPES = ["LOCAL_PRINT", "OVERSEAS", "CUSTOM"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

export default function NewListingPage() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    sourceType: "LOCAL_PRINT" as SourceType,
    price: "",
    currency: "NZD",
    adminToken: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessId(null);
    setLoading(true);

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      sourceType: form.sourceType,
      currency: form.currency,
    };
    if (form.category.trim()) payload.category = form.category.trim();
    if (form.price !== "") payload.price = parseFloat(form.price);

    try {
      const res = await fetch(`${API_BASE}/catalog`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(form.adminToken ? { Authorization: `Bearer ${form.adminToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message ?? `Error ${res.status}`);
        return;
      }

      setSuccessId(data.listingId ?? data.id ?? JSON.stringify(data));
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        category: "",
        price: "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Listing</h1>

      {successId && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Listing created. ID: <strong>{successId}</strong>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              type="text"
              required
              value={form.title}
              onChange={handleChange}
              placeholder="Product name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              required
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the product..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="category"
              name="category"
              type="text"
              value={form.category}
              onChange={handleChange}
              placeholder="e.g. Figurines"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sourceType">Source Type</Label>
            <Select
              value={form.sourceType}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, sourceType: val as SourceType }))
              }
            >
              <SelectTrigger id="sourceType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                type="text"
                value={form.currency}
                onChange={handleChange}
                placeholder="NZD"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminToken">Admin Token</Label>
            <Input
              id="adminToken"
              name="adminToken"
              type="password"
              value={form.adminToken}
              onChange={handleChange}
              placeholder="Bearer token for protected endpoints"
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Listing"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
