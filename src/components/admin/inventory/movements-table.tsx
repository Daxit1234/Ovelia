import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventoryMovementDoc, MovementType } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  reserve: "Reserved (online payment)",
  release: "Reservation released",
  commit: "Sold (payment confirmed)",
  sale: "Sold (COD)",
  restock: "Restocked (cancellation)",
  return: "Returned to stock",
  adjustment: "Manual adjustment",
  import: "CSV import",
  initial: "Opening stock",
};

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

export function MovementsTable({ movements }: { movements: InventoryMovementDoc[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Product / SKU</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Available Δ</TableHead>
          <TableHead className="text-right">Reserved Δ</TableHead>
          <TableHead className="text-right">After</TableHead>
          <TableHead>By / reference</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((m) => (
          <TableRow key={m._id.toHexString()}>
            <TableCell className="text-xs whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
            <TableCell className="text-sm">
              {m.productName ? (
                <span className="block">
                  {m.productName}
                  {m.variantLabel ? <span className="text-muted-foreground"> · {m.variantLabel}</span> : null}
                </span>
              ) : null}
              <span className="font-mono text-xs text-muted-foreground">{m.sku}</span>
            </TableCell>
            <TableCell className="text-sm">
              {MOVEMENT_LABELS[m.type] ?? m.type}
              {m.reason ? <span className="block text-xs text-muted-foreground">{m.reason}</span> : null}
            </TableCell>
            <TableCell className={`text-right tabular-nums ${m.stockChange < 0 ? "text-rose-700" : m.stockChange > 0 ? "text-emerald-700" : ""}`}>{signed(m.stockChange)}</TableCell>
            <TableCell className="text-right tabular-nums">{signed(m.reservedChange)}</TableCell>
            <TableCell className="text-right tabular-nums">{m.stockAfter ?? "—"}</TableCell>
            <TableCell className="text-xs">
              {m.actor?.name ?? "System"}
              {m.orderNumber ? <span className="block text-muted-foreground">{m.orderNumber}</span> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
