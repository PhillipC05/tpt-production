"use client";

import { useRef } from "react";
import { Button } from "@tpt/ui/button";
import { addToCart } from "@/lib/cart";

interface Props {
  listingId: string;
  title: string;
  price: number;
  currency: string;
}

export function AddToCartButton({ listingId, title, price, currency }: Props) {
  const labelRef = useRef<HTMLSpanElement>(null);

  function handleClick() {
    addToCart({ listingId, title, price, currency });
    if (labelRef.current) {
      labelRef.current.textContent = "Added!";
      setTimeout(() => {
        if (labelRef.current) labelRef.current.textContent = "Add to Cart";
      }, 1000);
    }
  }

  return (
    <Button onClick={handleClick} size="lg">
      <span ref={labelRef}>Add to Cart</span>
    </Button>
  );
}
