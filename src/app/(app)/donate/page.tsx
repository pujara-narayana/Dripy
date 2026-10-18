import type { Metadata } from "next";
import { Donate } from "@/components/proto/Donate";

export const metadata: Metadata = {
  title: "Donate",
  description: "Give the pieces you don't wear a new home, and find the nearest drop-off.",
};

export default function DonatePage() {
  return <Donate />;
}
