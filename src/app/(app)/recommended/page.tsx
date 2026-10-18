import type { Metadata } from "next";
import { Recommended } from "@/components/proto/Recommended";

export const metadata: Metadata = {
  title: "Recommended",
  description: "Pieces you don't own yet that go with what you do.",
};

export default function RecommendedPage() {
  return <Recommended />;
}
