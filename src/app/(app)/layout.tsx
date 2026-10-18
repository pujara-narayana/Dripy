import { AppHeader } from "@/components/proto/AppHeader";

// Signed-in pages (src/proxy.ts sends everyone else to /welcome).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
