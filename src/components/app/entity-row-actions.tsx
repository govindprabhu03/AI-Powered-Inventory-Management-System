"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Reusable edit/delete menu for simple entities (suppliers, warehouses).
 *
 * The delete action is passed in as a Server Action reference — this is a
 * supported pattern: a Server Component may hand a Server Action to a Client
 * Component as a prop, and calling it still runs on the server.
 */
export function EntityRowActions({
  id,
  editHref,
  deleteAction,
  confirmText,
  label,
}: {
  id: string;
  editHref: string;
  deleteAction: (id: string) => Promise<unknown>;
  confirmText: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            aria-label={label}
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={editHref} />}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (confirm(confirmText)) {
              startTransition(async () => {
                await deleteAction(id);
                router.refresh();
              });
            }
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
