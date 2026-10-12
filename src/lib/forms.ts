import type { FieldValues, UseFormReturn } from "react-hook-form";

/** A form of any shape; transformed (resolver output) values are irrelevant to shared inputs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyForm<T extends FieldValues> = UseFormReturn<T, any, any>;
