"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, Upload } from "lucide-react";

import {
  deleteProductImage,
  recordProductImage,
  setPrimaryImage,
} from "@/app/(app)/products/image-actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { ProductImage } from "@/lib/data/product-images";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function ProductImages({
  productId,
  orgId,
  images,
}: {
  productId: string;
  orgId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    const supabase = createClient();

    try {
      for (const file of Array.from(files)) {
        if (!ALLOWED.includes(file.type)) {
          setError(`${file.name}: unsupported type`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          setError(`${file.name}: larger than 5 MB`);
          continue;
        }

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        // Path convention the storage RLS relies on: {org}/{product}/{uuid}.ext
        const path = `${orgId}/${productId}/${crypto.randomUUID()}.${ext}`;

        // Direct browser -> Storage upload. RLS on storage.objects authorises it.
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type });
        if (upErr) {
          setError(upErr.message);
          continue;
        }

        // Record the row (also decides primary for the first image).
        const res = await recordProductImage(productId, path);
        if (!res.ok) setError(res.error ?? "Could not save image");
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              {img.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              {img.isPrimary && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Primary
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!img.isPrimary && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    aria-label="Make primary"
                    disabled={isPending}
                    onClick={() => act(() => setPrimaryImage(img.id))}
                  >
                    <Star />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon-xs"
                  variant="destructive"
                  aria-label="Delete image"
                  disabled={isPending}
                  onClick={() => act(() => deleteProductImage(img.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {uploading ? "Uploading…" : "Upload images"}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          PNG, JPEG, WebP or GIF, up to 5 MB each.
        </p>
      </div>
    </div>
  );
}
