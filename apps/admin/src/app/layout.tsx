import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TPT Admin",
  description: "TPT Production maker & admin portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <aside className="w-56 border-r bg-muted/40 flex flex-col gap-1 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">TPT Admin</p>
          <Link href="/shops/dashboard" className="text-sm px-2 py-1.5 rounded hover:bg-accent">Dashboard</Link>
          <Link href="/shops/onboard" className="text-sm px-2 py-1.5 rounded hover:bg-accent">Register Shop</Link>
          <Link href="/catalog" className="text-sm px-2 py-1.5 rounded hover:bg-accent">Listings</Link>
          <Link href="/catalog/new" className="text-sm px-2 py-1.5 rounded hover:bg-accent">New Listing</Link>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
