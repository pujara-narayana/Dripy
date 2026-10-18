import { PublicHeader } from "@/components/proto/PublicHeader";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
