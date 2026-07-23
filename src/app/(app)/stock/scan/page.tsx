import Link from "next/link";
import { redirect } from "next/navigation";

import { BarcodeScanner } from "@/components/stock/barcode-scanner";
import { requireContext, canRecordStock } from "@/lib/auth/context";

export const metadata = { title: "Scan · Smart Inventory" };

export default async function ScanPage() {
  const ctx = await requireContext();
  if (!canRecordStock(ctx.activeOrg.role)) redirect("/stock");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href="/stock"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Stock
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Scan a product
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan a label to jump straight to recording a movement for that
          product. On a phone, open the deployed site — the camera needs HTTPS.
        </p>
      </div>

      <BarcodeScanner />
    </div>
  );
}
