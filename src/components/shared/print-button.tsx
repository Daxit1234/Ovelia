"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} variant="outline">
      <Printer className="size-4" /> Print / Save as PDF
    </Button>
  );
}
