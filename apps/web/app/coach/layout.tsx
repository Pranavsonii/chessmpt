import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [{ href: "/coach", label: "Tournaments" }];

export default function CoachLayout({ children }: LayoutProps<"/coach">) {
  return (
    <AppShell role="coach" nav={nav}>
      {children}
    </AppShell>
  );
}
