import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Brand className="text-xl" href="/login" />
          <p className="text-sm text-muted-foreground">
            Tournaments, played <span className="font-semibold text-brand">live</span>.
          </p>
        </div>
        {/* useSearchParams() inside the form needs a Suspense boundary */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
