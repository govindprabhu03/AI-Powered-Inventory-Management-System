import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CustomerForm } from "@/components/customers/customer-form";
import { requireContext, canManageSales } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit customer · Smart Inventory" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!canManageSales(ctx.activeOrg.role)) redirect("/customers");

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (!c) notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit customer</h1>
      </div>
      <CustomerForm
        customerId={id}
        defaultValues={{
          name: c.name,
          email: c.email ?? "",
          phone: c.phone ?? "",
          address: c.address ?? "",
        }}
      />
    </div>
  );
}
