import type { Metadata } from "next";
import { Suspense } from "react";
import { LogIn } from "@/components/proto/LogIn";

export const metadata: Metadata = { title: "Log in" };

export default function LogInPage() {
  return (
    <Suspense>
      <LogIn />
    </Suspense>
  );
}
