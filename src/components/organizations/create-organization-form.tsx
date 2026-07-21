"use client";

import { useActionState, useState } from "react";

import { createOrganization } from "@/app/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  slugify,
  type OrganizationActionState,
} from "@/lib/validation/organization";

export function CreateOrganizationForm() {
  const [state, formAction, isPending] = useActionState<
    OrganizationActionState,
    FormData
  >(createOrganization, {});

  // Local state purely to preview the slug as they type. The server derives the
  // real slug itself — this is a hint, not the source of truth.
  const [name, setName] = useState("");
  const preview = slugify(name);

  return (
    <form action={formAction} className="grid gap-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Traders"
          autoComplete="organization"
          required
          aria-invalid={!!state.fieldErrors?.name}
        />
        {state.fieldErrors?.name ? (
          <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {preview ? (
              <>
                URL: <span className="font-mono">/{preview}</span>
              </>
            ) : (
              "Your business name. You can change it later."
            )}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
