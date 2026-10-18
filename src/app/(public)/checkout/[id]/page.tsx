import type { Metadata } from "next";
import { Suspense } from "react";
import { Checkout } from "@/components/proto/Checkout";

export const metadata: Metadata = { title: "Checkout" };

// Opened from the link Dripy texts for a first purchase (signed ?t= token, no login needed).
export default function CheckoutPage() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
