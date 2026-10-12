"use client";

import { cloneElement, isValidElement, useId, useState, type ReactNode } from "react";
import type { FieldErrors } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Error message at a dotted path (e.g. "variants.0.sku") of react-hook-form errors. */
export function fieldError(errors: FieldErrors, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), errors);
  return (value as { message?: string } | undefined)?.message;
}

type ControlProps = { id?: string; render?: (...args: never[]) => ReactNode; "aria-describedby"?: string; "aria-invalid"?: boolean };

/**
 * Gives the field's control its id (so the label names it) and links the hint
 * and error text. Works for plain inputs and for react-hook-form Controllers,
 * whose rendered element receives the props.
 */
function linkControl(node: ReactNode, props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }): ReactNode {
  if (!isValidElement<ControlProps>(node)) return node;
  const { render } = node.props;
  if (typeof render === "function") {
    return cloneElement(node, { render: (...args: never[]) => linkControl(render(...args), props) } as Partial<ControlProps>);
  }
  return cloneElement(node, { ...props, id: node.props.id ?? props.id });
}

export function Field({ label, error, children, hint, className, htmlFor }: { label: string; error?: string; children: ReactNode; hint?: ReactNode; className?: string; htmlFor?: string }) {
  const autoId = useId();
  const childId = isValidElement<ControlProps>(children) ? children.props.id : undefined;
  const id = htmlFor ?? childId ?? autoId;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {htmlFor ? children : linkControl(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const selectClass = "h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm";

/** A labelled on/off setting with an explanation underneath. */
export function SwitchRow({ label, description, checked, onCheckedChange, disabled }: { label: string; description?: ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border p-3">
      <span>
        <span className="block text-sm font-medium text-brand-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}

/** One entry per line, edited as plain text. */
export function LinesInput({ value, onChange, placeholder, rows = 4, id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; rows?: number; id?: string }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <Textarea
      id={id}
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

/** Searchable multi-select checklist (products, categories…). */
export function ProductPicker({
  options,
  value,
  onChange,
  max,
  exclude,
  searchLabel = "Search products",
  emptyLabel = "No products",
}: {
  options: { id: string; name: string; depth?: number }[];
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  exclude?: string;
  searchLabel?: string;
  emptyLabel?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.id !== exclude && o.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2">
      <Input placeholder={searchLabel} value={q} onChange={(e) => setQ(e.target.value)} className="h-8" aria-label={searchLabel} />
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
        {filtered.map((o) => {
          const checked = value.includes(o.id);
          return (
            <li key={o.id} style={o.depth ? { paddingLeft: o.depth * 16 } : undefined}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={!checked && value.length >= max}
                  onCheckedChange={(c) => onChange(c === true ? [...value, o.id] : value.filter((id) => id !== o.id))}
                />
                {o.name}
              </label>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="text-xs text-muted-foreground">{emptyLabel}</li> : null}
      </ul>
      <p className="text-xs text-muted-foreground">
        {value.length}/{max} selected
      </p>
    </div>
  );
}
