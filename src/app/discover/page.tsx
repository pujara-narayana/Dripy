import type { Metadata } from "next";
import { Discover } from "@/components/proto/Discover";

const description = "Discover considered layers, everyday staples, and clothing from real shops to complement your closet.";

export const metadata: Metadata = {
  title: "Discover",
  description,
  openGraph: { title: "Discover — dripy.", description: "A fresh edit of everyday pieces to complement your closet." },
};

export default function DiscoverPage() {
  return <Discover />;
}
