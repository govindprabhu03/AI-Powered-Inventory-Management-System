import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SupplierForm } from "@/components/suppliers/supplier-form";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit supplier · Smart Inventory" };

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/suppliers");

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();
  if (!s) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/suppliers" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Suppliers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit supplier</h1>
      </div>
      <SupplierForm
        supplierId={id}
        defaultValues={{
          companyName: s.company_name,
          contactPerson: s.contact_person ?? "",
          email: s.email ?? "",
          phone: s.phone ?? "",
          gstNumber: s.gst_number ?? "",
          address: s.address ?? "",
        }}
      />
    </div>
  );
}
