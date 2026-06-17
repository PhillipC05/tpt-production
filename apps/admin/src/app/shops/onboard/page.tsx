"use client";

import { useState } from "react";
import { buttonVariants } from "@tpt/ui/button";
import { Input } from "@tpt/ui/input";
import { Label } from "@tpt/ui/label";
import { Card } from "@tpt/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export default function OnboardPage() {
  const [form, setForm] = useState({
    email: "",
    name: "",
    locationLat: "",
    locationLng: "",
    capacity: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessId(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/shops/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          locationLat: parseFloat(form.locationLat),
          locationLng: parseFloat(form.locationLng),
          capacity: parseInt(form.capacity, 10),
        }),
      });

      if (res.status === 409) {
        setError("User already has a shop.");
        return;
      }

      if (res.status === 201) {
        const data = await res.json();
        setSuccessId(data.shopId ?? data.id ?? JSON.stringify(data));
        return;
      }

      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Unexpected error (${res.status})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Register Maker Shop</h1>

      {successId && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Shop registered successfully. Shop ID: <strong>{successId}</strong>
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="maker@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Shop Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="My Print Shop"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="locationLat">Latitude</Label>
              <Input
                id="locationLat"
                name="locationLat"
                type="number"
                step="any"
                required
                value={form.locationLat}
                onChange={handleChange}
                placeholder="-36.8485"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="locationLng">Longitude</Label>
              <Input
                id="locationLng"
                name="locationLng"
                type="number"
                step="any"
                required
                value={form.locationLng}
                onChange={handleChange}
                placeholder="174.7633"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min="0"
              value={form.capacity}
              onChange={handleChange}
            />
          </div>

          <button type="submit" disabled={loading} className={buttonVariants()}>
            {loading ? "Registering..." : "Register Shop"}
          </button>
        </form>
      </Card>
    </div>
  );
}
