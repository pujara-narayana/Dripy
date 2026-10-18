import type { Metadata } from "next";
import { SettingsPanel } from "@/components/proto/SettingsPanel";

export const metadata: Metadata = {
  title: "Settings",
  description: "Set how much your fairy can spend for you and what it recommends.",
};

export default function SettingsPage() {
  return <SettingsPanel />;
}
