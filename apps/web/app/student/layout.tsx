import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { href: "/student", label: "Tournaments" },
  { href: "/student/schedule", label: "My schedule" },
  { href: "/student/history", label: "Match history" },
];

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return (
    <AppShell role="student" nav={nav}>
      {children}
    </AppShell>
  );
}
