"use client";

import { useActionState } from "react";
import Link from "next/link";

import { login } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthActionState } from "@/lib/validation/auth";

/**
 * A Client Component, because it needs useActionState to show pending and
 * error states. The Server Action it calls still runs entirely on the server.
 *
 * useActionState returns [state, formAction, isPending]:
 *   state     — whatever the action returned last time (errors, success)
 *   formAction— pass to <form action=...>
 *   isPending — true while the action is in flight, for disabling the button
 */
export function LoginForm({ oauthError }: { oauthError?: string }) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    login,
    {},
  );

  const error = state.error ?? oauthError;

  return (
    <form action={formAction} className="grid gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          aria-invalid={!!state.fieldErrors?.email}
        />
        {state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
