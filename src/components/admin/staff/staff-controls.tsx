"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addStaffAction, changeStaffRoleAction } from "@/app/admin/staff/actions";
import { selectClass } from "@/components/admin/form-fields";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/domain/roles";

export function AddStaffDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("support_agent");
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const result = await addStaffAction({ email, role });
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Added");
      setOpen(false);
      setEmail("");
      router.refresh();
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" /> Add staff member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a staff member</DialogTitle>
          <DialogDescription>They need an Ovelia account first: ask them to sign up on the store with their work email, then add that email here. Their password stays private to them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Account email</Label>
            <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-role">Role</Label>
            <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={selectClass}>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !email.includes("@")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RoleSelect({ userId, role, name, disabled }: { userId: string; role: StaffRole; name: string; disabled?: boolean }) {
  const router = useRouter();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();
  const apply = (next: string) =>
    startTransition(async () => {
      const result = await changeStaffRoleAction(userId, next);
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message ?? "Saved");
      setConfirmRemove(false);
      router.refresh();
    });
  return (
    <>
      <select
        aria-label={`Role for ${name}`}
        value={role}
        disabled={disabled || pending}
        onChange={(e) => (e.target.value === "customer" ? setConfirmRemove(true) : apply(e.target.value))}
        className={`${selectClass} w-48`}
      >
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
        <option value="customer">Remove staff access…</option>
      </select>
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name} from the team?</AlertDialogTitle>
            <AlertDialogDescription>They keep their customer account and order history but lose access to the admin immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                apply("customer");
              }}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null} Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
