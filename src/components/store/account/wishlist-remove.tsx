"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlistAction } from "@/app/actions/catalog";

export function WishlistRemoveButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleWishlistAction(productId);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        })
      }
      className="absolute top-3 right-3 z-20 grid size-8 place-items-center rounded-full bg-white/95 text-muted-foreground shadow hover:text-destructive"
      aria-label={`Remove ${name} from wishlist`}
    >
      <X className="size-4" />
    </button>
  );
}
