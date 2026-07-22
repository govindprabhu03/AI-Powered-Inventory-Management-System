import Link from "next/link";
import { redirect } from "next/navigation";

import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requireContext, canEditCatalog } from "@/lib/auth/context";

export const metadata = { title: "Add supplier · Smart Inventory" };

export default async function NewSupplierPage() {
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/suppliers");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/suppliers" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Suppliers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add supplier</h1>
      </div>
      <SupplierForm />
    </div>
  );
}
