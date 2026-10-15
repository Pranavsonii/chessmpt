"use client";

import { Swords } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { useMe } from "@/lib/auth";

export default function StudentHomePage() {
  const { data: me } = useMe();
  return (
    <>
      <PageHeader
        title={`Hi, ${me?.name.split(" ")[0] ?? "there"} 👋`}
        description="Join a tournament, find an opponent and play live."
      />
      {/* Replaced by browse / join in Phase 6 */}
      <EmptyState
        icon={Swords}
        title="Tournaments are coming next"
        description="This is the student area. Only students can open it."
      />
    </>
  );
}
