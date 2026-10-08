import type { ReactNode } from "react";
import { BottomNav } from "@/components/shell/BottomNav";
import { DemoBanner } from "@/components/shell/DemoBanner";
import { Header } from "@/components/shell/Header";
import { InstallTip } from "@/components/shell/InstallTip";
import { ProfileGate } from "@/components/shell/ProfileGate";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileGate>
      <DemoBanner />
      <Header />
      <InstallTip />
      <main className="mx-auto w-full max-w-app flex-1 px-4 pt-4 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+1.5rem)]">
        {children}
      </main>
      <BottomNav />
    </ProfileGate>
  );
}
