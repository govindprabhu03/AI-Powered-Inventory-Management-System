import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerForm } from "@/components/customers/customer-form";
import { requireContext, canManageSales } from "@/lib/auth/context";

export const metadata = { title: "Add customer · Smart Inventory" };

export default async function NewCustomerPage() {
  const ctx = await requireContext();
  if (!canManageSales(ctx.activeOrg.role)) redirect("/customers");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add customer</h1>
      </div>
      <CustomerForm />
    </div>
  );
}
