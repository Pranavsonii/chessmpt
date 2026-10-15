"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isApiError } from "@/lib/api/client";
import { useLogin } from "@/lib/auth";

export function LoginForm() {
  const params = useSearchParams();
  const login = useLogin(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const fieldErrors = isApiError(login.error) ? login.error.fieldErrors : {};
  const formError =
    login.error && Object.keys(fieldErrors).length === 0
      ? isApiError(login.error)
        ? login.error.message
        : "Something went wrong. Please try again."
      : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Log in with your academy account.</CardDescription>
      </CardHeader>
      <CardContent>
        {params.get("expired") && !login.error && (
          <Alert className="mb-4">
            <AlertDescription>Your session ended. Please log in again.</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              required
              autoFocus
            />
            {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              required
            />
            {fieldErrors.password && (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={login.isPending || login.isSuccess || !email || !password}
          >
            {login.isPending || login.isSuccess ? (
              <>
                <Loader2 className="animate-spin" /> Logging in…
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
