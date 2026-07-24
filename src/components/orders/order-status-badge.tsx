import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  received: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  fulfilled: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

const label = (s: string) => s.replace(/_/g, " ");

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("border-transparent capitalize", STATUS_STYLES[status])}>
      {label(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("border-transparent capitalize", PAYMENT_STYLES[status])}>
      {status}
    </Badge>
  );
}
