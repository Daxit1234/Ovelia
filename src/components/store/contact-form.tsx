"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitContactAction, type ContactInput } from "@/app/actions/contact";
import { TextField } from "@/components/store/checkout/address-fields";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SUBJECTS = ["Order support", "Product question", "Returns & refunds", "Bulk / business enquiry", "Feedback", "Other"] as const;

export function ContactForm({ defaultOrderNumber }: { defaultOrderNumber?: string }) {
  const [sent, setSent] = useState(false);
  const form = useForm<ContactInput>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: defaultOrderNumber ? "Order support" : (undefined as never),
      orderNumber: defaultOrderNumber ?? "",
      message: "",
      website: "",
    },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await submitContactAction(values);
    if (!result.ok) {
      if (result.fieldErrors) for (const [path, messages] of Object.entries(result.fieldErrors)) form.setError(path as never, { message: messages[0] });
      toast.error(result.error);
      return;
    }
    setSent(true);
  });
  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border bg-white p-10 text-center" role="status">
        <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
        <h2 className="font-heading text-xl font-bold">Message sent</h2>
        <p className="text-muted-foreground">Thanks for reaching out. We&apos;ve emailed you a confirmation and will reply as soon as possible.</p>
      </div>
    );
  }
  const subjectError = form.formState.errors.subject;
  const messageError = form.formState.errors.message;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-3xl border bg-white p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="name" label="Your name" autoComplete="name" />
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        <TextField form={form} name="phone" label="Mobile number" type="tel" autoComplete="tel-national" optional />
        <TextField form={form} name="orderNumber" label="Order number" optional placeholder="e.g. OV-261012-ABCDE" />
      </div>
      <Field data-invalid={!!subjectError}>
        <FieldLabel htmlFor="contact-subject">Topic</FieldLabel>
        <Controller
          control={form.control}
          name="subject"
          rules={{ required: "Choose a topic" }}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="contact-subject" className="h-11 w-full">
                <SelectValue placeholder="Choose a topic" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={[subjectError]} />
      </Field>
      <Field data-invalid={!!messageError}>
        <FieldLabel htmlFor="contact-message">Message</FieldLabel>
        <Textarea id="contact-message" rows={6} maxLength={3000} {...form.register("message")} />
        <FieldError errors={[messageError]} />
      </Field>
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden {...form.register("website")} />
      <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null} Send message
      </Button>
      <p className="text-xs text-muted-foreground">We use your details only to respond to your message. See our Privacy Policy.</p>
    </form>
  );
}
