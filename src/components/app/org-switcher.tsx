"use client";

import { useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";

import { setActiveOrg } from "@/app/organizations/switch-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Membership } from "@/lib/auth/context";

export function OrgSwitcher({
  activeOrgId,
  memberships,
}: {
  activeOrgId: string;
  memberships: Membership[];
}) {
  const [isPending, startTransition] = useTransition();
  const active = memberships.find((m) => m.orgId === activeOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-between"
            disabled={isPending}
          >
            <span className="truncate">{active?.name ?? "Select organization"}</span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent className="w-56">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.orgId}
            onClick={() =>
              startTransition(() => {
                setActiveOrg(m.orgId);
              })
            }
          >
            <span className="truncate">{m.name}</span>
            {m.orgId === activeOrgId && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/organizations/new" />}>
          <Plus />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
