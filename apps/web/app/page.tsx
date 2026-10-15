import { redirect } from "next/navigation";

/** proxy.ts normally redirects "/" by role first; this is the fallback. */
export default function Home() {
  redirect("/login");
}
