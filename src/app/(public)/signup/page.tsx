import type { Metadata } from "next";
import { SignUp } from "@/components/proto/SignUp";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return <SignUp />;
}
