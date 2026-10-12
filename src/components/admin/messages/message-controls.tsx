"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateMessageAction } from "@/app/admin/messages/actions";
import { selectClass } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Status = "new" | "in_progress" | "resolved";

export function MessageControls({ messageId, status, notes }: { messageId: string; status: Status; notes: string }) {
  const router = useRouter();
  const [next, setNext] = useState<Status>(status);
  const [text, setText] = useState(notes);
  const [pending, startTransition] = useTransition();
  const dirty = next !== status || text !== notes;
  const save = () =>
    startTransition(async () => {
      const result = await updateMessageAction(messageId, { status: next, notes: text });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Saved");
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <select aria-label="Status" value={next} onChange={(e) => setNext(e.target.value as Status)} className={selectClass}>
        <option value="new">New</option>
        <option value="in_progress">In progress</option>
        <option value="resolved">Resolved</option>
      </select>
      <Textarea aria-label="Internal notes" rows={3} maxLength={2000} placeholder="Internal notes (not sent to the customer)" value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" className="w-full" onClick={save} disabled={!dirty || pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save
      </Button>
    </div>
  );
}
