"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export type LabelProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
};

export function LabelSheet({ products }: { products: LabelProduct[] }) {
  return (
    <>
      {/* Print rules: hide the app chrome (the layout's <aside> sidebar) and the
          toolbar, so only the label grid reaches the paper. */}
      <style>{`
        @media print {
          aside { display: none !important; }
          [data-no-print] { display: none !important; }
          .label-sheet { gap: 0.25rem; }
          .label-cell { break-inside: avoid; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-4" data-no-print>
        <p className="text-sm text-muted-foreground">
          {products.length} label{products.length === 1 ? "" : "s"}
        </p>
        <Button type="button" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>

      <div className="label-sheet grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.map((p) => (
          <Label key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}

function Label({ product }: { product: LabelProduct }) {
  const code = product.barcode?.trim() || product.sku;
  return (
    <div className="label-cell flex items-center gap-3 rounded-lg border p-3">
      <Qr value={code} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
        <Barcode value={code} />
      </div>
    </div>
  );
}

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height: 34,
        width: 1.4,
        fontSize: 11,
        margin: 0,
      });
    } catch {
      // JsBarcode throws on values it can't encode; leave the SVG empty.
    }
  }, [value]);
  return <svg ref={ref} className="mt-1 max-w-full" />;
}

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: 96 })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value]);

  if (!src) return <div className="size-16 shrink-0 rounded bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={64} height={64} className="size-16 shrink-0" />;
}
