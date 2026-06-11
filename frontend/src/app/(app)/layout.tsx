import { Navbar } from "@/components/layout/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <Navbar />
      <main className="relative min-h-0 flex-1">{children}</main>
    </div>
  );
}
