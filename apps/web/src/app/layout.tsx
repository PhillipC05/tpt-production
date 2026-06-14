import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TPT Marketplace",
  description: "3D printing marketplace powered by TPT Production",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-background">
          <div className="container flex h-14 items-center gap-6">
            <Link href="/" className="font-semibold text-sm tracking-tight">
              TPT Marketplace
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/catalog" className="hover:text-foreground transition-colors">Browse</Link>
              <Link href="/designs/upload" className="hover:text-foreground transition-colors">Upload Design</Link>
              <Link href="/orders/custom" className="hover:text-foreground transition-colors">Custom Order</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
