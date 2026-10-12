import { z } from "zod";

/** Internal paths ("/shop") or https links only, never javascript: or protocol-relative URLs. */
export const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/i.test(v), "Use a path such as /shop or a full https:// link");
