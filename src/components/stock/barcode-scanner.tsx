"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";

import { lookupProductByCode } from "@/app/(app)/stock/actions";

/**
 * Camera barcode/QR scanner.
 *
 * html5-qrcode drives the camera and decodes frames; on a hit we look the code
 * up server-side (org-scoped) and jump straight to the record form with the
 * product pre-selected. Camera access needs HTTPS or localhost — on a phone,
 * use the deployed site.
 */
export function BarcodeScanner() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Blocks re-entrancy: the decoder fires repeatedly for the same frame, and we
  // only want one lookup in flight.
  const busyRef = useRef(false);

  const [status, setStatus] = useState<
    | { kind: "starting" }
    | { kind: "scanning" }
    | { kind: "found"; label: string }
    | { kind: "miss"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "starting" });

  useEffect(() => {
    const scanner = new Html5Qrcode("scanner-viewport");
    scannerRef.current = scanner;
    let cancelled = false;

    scanner
      .start(
        { facingMode: "environment" }, // back camera on phones
        { fps: 10, qrbox: { width: 260, height: 160 } },
        async (decodedText) => {
          if (busyRef.current) return;
          busyRef.current = true;

          const result = await lookupProductByCode(decodedText);
          if (cancelled) return;

          if (result.ok) {
            setStatus({ kind: "found", label: result.product.name });
            router.push(`/stock/record?product=${result.product.id}`);
            // no busy reset — we're navigating away
          } else {
            setStatus({ kind: "miss", message: result.error });
            // let the message breathe, then resume scanning
            setTimeout(() => {
              if (!cancelled) {
                setStatus({ kind: "scanning" });
                busyRef.current = false;
              }
            }, 1500);
          }
        },
        () => {
          // per-frame decode failures are normal noise; ignore
        },
      )
      .then(() => {
        if (!cancelled) setStatus({ kind: "scanning" });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not start the camera. Allow camera access and use HTTPS.",
          });
        }
      });

    return () => {
      cancelled = true;
      // stop() rejects if the camera never started; that's fine on unmount.
      scanner.stop().catch(() => {});
    };
  }, [router]);

  return (
    <div className="grid gap-3">
      <div
        id="scanner-viewport"
        className="overflow-hidden rounded-lg border bg-black [&_video]:w-full"
      />

      <p
        role="status"
        className={
          status.kind === "error" || status.kind === "miss"
            ? "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            : "px-1 text-sm text-muted-foreground"
        }
      >
        {status.kind === "starting" && "Starting camera…"}
        {status.kind === "scanning" && "Point the camera at a barcode or QR label."}
        {status.kind === "found" && `Found ${status.label} — opening…`}
        {status.kind === "miss" && status.message}
        {status.kind === "error" && status.message}
      </p>
    </div>
  );
}
