"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { applyProductImportAction, previewProductImportAction, type ImportPreview } from "@/app/admin/products/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MAX_IMPORT_BYTES, type CsvIssue } from "@/lib/admin/product-csv";
import type { ImportSummary } from "@/lib/admin/product-import";

function SummaryChips({ summary }: { summary: ImportSummary }) {
  const chips: [string, number][] = [
    ["Rows read", summary.rows],
    ["New products", summary.productsCreated],
    ["Products updated", summary.productsUpdated],
    ["New variants", summary.variantsCreated],
    ["Variants updated", summary.variantsUpdated],
    ["Stock changes", summary.stockChanges],
    ["Unchanged products", summary.unchangedProducts],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {chips.map(([label, value]) => (
        <div key={label} className="rounded-xl border bg-muted/30 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-heading text-lg font-bold tabular-nums text-brand-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function IssueList({ issues, title }: { issues: CsvIssue[]; title: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-rose-900">
        <AlertTriangle className="size-4" aria-hidden /> {title}
      </p>
      <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-sm text-rose-900">
        {issues.map((issue, i) => (
          <li key={i}>
            {issue.line > 0 ? <span className="font-semibold tabular-nums">Line {issue.line}: </span> : null}
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ summary: ImportSummary; failures: CsvIssue[]; message?: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const choose = async (picked: File | undefined) => {
    setPreview(null);
    setResult(null);
    if (!picked) return setFile(null);
    if (picked.size > MAX_IMPORT_BYTES) {
      toast.error(`That file is larger than ${Math.round(MAX_IMPORT_BYTES / 1024)} KB. Split it into smaller files.`);
      if (inputRef.current) inputRef.current.value = "";
      return setFile(null);
    }
    setFile({ name: picked.name, size: picked.size, text: await picked.text() });
  };

  const runPreview = () =>
    startTransition(async () => {
      if (!file) return;
      const res = await previewProductImportAction(file.text);
      if (!res.ok) return void toast.error(res.error);
      setPreview(res.data);
    });

  const runImport = () =>
    startTransition(async () => {
      if (!file) return;
      const res = await applyProductImportAction(file.text);
      setConfirmOpen(false);
      if (!res.ok) return void toast.error(res.error);
      setResult({ ...res.data, message: res.message });
      setPreview(null);
      toast.success(res.message ?? "Import complete");
      router.refresh();
    });

  const changeCount = preview ? preview.summary.productsCreated + preview.summary.productsUpdated : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed bg-white p-5">
        <FileSpreadsheet className="size-8 text-brand-teal" aria-hidden />
        <div className="min-w-0 flex-1">
          <label htmlFor="product-csv" className="block text-sm font-semibold text-brand-ink">
            CSV file
          </label>
          <input
            ref={inputRef}
            id="product-csv"
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-mint file:px-3 file:py-1.5 file:font-semibold file:text-brand-green"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
          {file ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          ) : null}
        </div>
        <Button onClick={runPreview} disabled={!file || pending}>
          {pending && !confirmOpen ? <Loader2 className="size-4 animate-spin" /> : null} Preview changes
        </Button>
      </div>

      {preview ? (
        <section aria-label="Import preview" className="space-y-4 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-brand-ink">Preview</h2>
              <p className="text-sm text-muted-foreground">Nothing has been changed yet.</p>
            </div>
            {preview.issues.length === 0 && changeCount > 0 ? (
              <Button onClick={() => setConfirmOpen(true)} disabled={pending}>
                Import {changeCount} product{changeCount === 1 ? "" : "s"}
              </Button>
            ) : null}
          </div>
          <SummaryChips summary={preview.summary} />
          {preview.issues.length ? (
            <IssueList issues={preview.issues} title={`Fix ${preview.issues.length} problem${preview.issues.length === 1 ? "" : "s"} in the file, then preview again. Nothing will be imported until the file is clean.`} />
          ) : changeCount === 0 ? (
            <p className="rounded-xl bg-muted/40 p-4 text-sm">The catalog already matches this file. There is nothing to import.</p>
          ) : null}
          {preview.items.length ? (
            <ul className="divide-y rounded-xl border">
              {preview.items.map((item) => (
                <li key={`${item.kind}-${item.slug}`} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={item.kind === "create" ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900"}>{item.kind === "create" ? "New" : "Update"}</Badge>
                    <span className="font-semibold text-brand-ink">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      /{item.slug} · line{item.lines.length === 1 ? "" : "s"} {item.lines.join(", ")}
                    </span>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {item.changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section aria-label="Import result" className="space-y-4 rounded-2xl border bg-white p-5">
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="size-5" aria-hidden /> {result.message ?? "Import complete"}
          </p>
          <SummaryChips summary={result.summary} />
          {result.failures.length ? <IssueList issues={result.failures} title="These products could not be saved. Everything else was imported." /> : null}
        </section>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {preview
                ? `${preview.summary.productsCreated} new and ${preview.summary.productsUpdated} updated products, with ${preview.summary.stockChanges} stock change${preview.summary.stockChanges === 1 ? "" : "s"}. Changes are checked again against the live catalog before saving, and every stock change is logged.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                runImport();
              }}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null} Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
