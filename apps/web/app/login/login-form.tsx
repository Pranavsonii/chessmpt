"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FieldError, Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { isApiError } from "@/lib/api/client";
import { useLogin } from "@/lib/auth";
import { collectErrors, validateEmail, validatePassword } from "@/lib/validation";

type Field = "email" | "password";

/** Turns a failed login into a message the user can act on. */
function describeLoginError(error: unknown): { title: string; text: string } {
  if (!isApiError(error)) return { title: "Something went wrong", text: "Please try again." };
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return { title: "Wrong email or password", text: "Check both and try again." };
    case "TOO_MANY_LOGIN_ATTEMPTS":
      return { title: "Too many attempts", text: error.message };
    case "NETWORK_ERROR":
      return { title: "You're offline", text: error.message };
    default:
      return { title: "Couldn't log you in", text: error.message };
  }
}

export function LoginForm() {
  const params = useSearchParams();
  const login = useLogin(params.get("next"));
  const [values, setValues] = useState<Record<Field, string>>({ email: "", password: "" });
  // A field shows its error only once the user has left it (or submitted).
  const [touched, setTouched] = useState<Record<Field, boolean>>({ email: false, password: false });
  const [showSessionNote, setShowSessionNote] = useState(params.get("expired") === "1");
  const [errorDismissed, setErrorDismissed] = useState(false);

  const clientErrors = collectErrors<Field>({
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  });
  const serverFieldErrors = isApiError(login.error) ? login.error.fieldErrors : {};
  const errorOf = (f: Field) => (touched[f] ? clientErrors[f] : undefined) ?? serverFieldErrors[f];

  const formError =
    login.error && !errorDismissed && Object.keys(serverFieldErrors).length === 0
      ? describeLoginError(login.error)
      : null;

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [f]: e.target.value }));
  const blur = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.keys(clientErrors).length > 0) {
      // Put the cursor on the first problem so keyboard users aren't lost.
      document.getElementById(clientErrors.email ? "email" : "password")?.focus();
      return;
    }
    setErrorDismissed(false);
    setShowSessionNote(false);
    login.mutate({ email: values.email.trim(), password: values.password });
  }

  const busy = login.isPending || login.isSuccess;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Log in with your academy account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {showSessionNote && !formError && (
            <Notice kind="info" onDismiss={() => setShowSessionNote(false)}>
              Your session ended. Please log in again.
            </Notice>
          )}
          {formError && (
            <Notice kind="error" title={formError.title} onDismiss={() => setErrorDismissed(true)}>
              {formError.text}
            </Notice>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={set("email")}
              onBlur={blur("email")}
              aria-invalid={!!errorOf("email")}
              aria-describedby={errorOf("email") ? "email-error" : undefined}
              maxLength={255}
              required
              autoFocus
            />
            <FieldError id="email-error">{errorOf("email")}</FieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={values.password}
              onChange={set("password")}
              onBlur={blur("password")}
              aria-invalid={!!errorOf("password")}
              aria-describedby={errorOf("password") ? "password-error" : undefined}
              maxLength={128}
              required
            />
            <FieldError id="password-error">{errorOf("password")}</FieldError>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
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
