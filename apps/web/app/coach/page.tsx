"use client";

import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { useMe } from "@/lib/auth";

export default function CoachHomePage() {
  const { data: me } = useMe();
  return (
    <>
      <PageHeader
        title={`Welcome, ${me?.name.split(" ")[0] ?? "Coach"}`}
        description="Create tournaments, open registration and follow results."
      />
      {/* Replaced by the tournament list in Phase 5 */}
      <EmptyState
        icon={Trophy}
        title="Tournament management is coming next"
        description="This is the coach area. Only coaches can open it."
      />
    </>
  );
}
