"use client";

import { useState, FormEvent } from "react";
import { Button, buttonVariants } from "@tpt/ui/button";
import { Input } from "@tpt/ui/input";
import { Label } from "@tpt/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@tpt/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export default function CustomOrderPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [request, setRequest] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const requestTooShort = request.trim().length > 0 && request.trim().length < 20;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (request.trim().length < 20) {
      setErrorMessage("Please describe your request in at least 20 characters.");
      return;
    }
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch(`${API_URL}/orders/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, request }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Request failed: ${res.status}`);
      }

      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="container py-12 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Request Received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Thank you, <strong>{name}</strong>. Your custom order request has been submitted.
              We will be in touch at <strong>{email}</strong> with a quote shortly.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setName("");
                setEmail("");
                setPhone("");
                setRequest("");
                setStatus("idle");
              }}
            >
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Custom Order Request</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Tell us what you need printed and we will match you with a local maker and provide a quote.
      </p>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+64 21 000 0000"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="request">
                Order Description <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="request"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="Describe what you need printed — dimensions, material preferences, quantity, intended use, etc."
                required
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[100px]"
              />
              {requestTooShort && (
                <p className="text-xs text-destructive">
                  Description must be at least 20 characters ({request.trim().length}/20).
                </p>
              )}
            </div>

            {status === "error" && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                {errorMessage}
              </p>
            )}

            <button type="submit" disabled={status === "submitting"} className={buttonVariants({ className: "w-full" })}>
              {status === "submitting" ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
