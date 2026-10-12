import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { deleteContentAction } from "@/app/admin/content/actions";
import { ActionButton } from "@/components/admin/action-button";
import { BannerDialog, FaqDialog, TestimonialDialog } from "@/components/admin/content/content-dialogs";
import { AnnouncementForm, HomepageForm } from "@/components/admin/content/content-settings-forms";
import { AdminPageHeader, EmptyState } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { oneOf, param } from "@/lib/admin/list";
import { Banner, connectDB, Faq, Testimonial } from "@/lib/db";
import { formatDate, toIstDateTimeInput, truncate } from "@/lib/format";
import { loadSettings } from "@/lib/services/settings";
import { cn } from "@/lib/utils";
import { EMPTY_BANNER, EMPTY_FAQ, EMPTY_TESTIMONIAL } from "@/lib/validation/content";

export const metadata: Metadata = { title: "Storefront content" };

const TABS = { homepage: "Homepage", banners: "Banners", faqs: "FAQs", testimonials: "Testimonials", announcement: "Announcement bar" } as const;
type Tab = keyof typeof TABS;

function DeleteButton({ kind, id, label }: { kind: "banner" | "faq" | "testimonial"; id: string; label: string }) {
  return (
    <ActionButton variant="ghost" className="text-destructive hover:text-destructive" action={deleteContentAction.bind(null, kind, id)} confirm={{ title: `Delete “${truncate(label, 60)}”?`, description: "This can't be undone." }} confirmLabel="Delete">
      Delete
    </ActionButton>
  );
}

function Visible({ on, labels = ["Visible", "Hidden"] }: { on: boolean; labels?: [string, string] }) {
  return <Badge className={on ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-900"}>{on ? labels[0] : labels[1]}</Badge>;
}

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requireStaffPage("content:write", "/admin/content");
  const tab = oneOf(param(await searchParams, "tab"), Object.keys(TABS) as Tab[], "homepage");
  await connectDB();

  let body: React.ReactNode = null;
  if (tab === "homepage" || tab === "announcement") {
    const settings = await loadSettings();
    body = tab === "homepage" ? <HomepageForm initial={settings.homepage} /> : <AnnouncementForm initial={settings.announcement} />;
  } else if (tab === "banners") {
    const banners = await Banner.find().sort({ placement: 1, sortOrder: 1, createdAt: -1 }).lean();
    body = (
      <>
        <div className="mb-4 flex justify-end">
          <BannerDialog initial={EMPTY_BANNER} trigger={<Button><Plus className="size-4" /> New banner</Button>} />
        </div>
        {banners.length === 0 ? (
          <EmptyState title="No banners yet" description="Without a hero banner, the home page shows the hero text from the Homepage tab." />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banner</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banners.map((b) => {
                  const id = b._id.toHexString();
                  return (
                    <TableRow key={id}>
                      <TableCell className="max-w-80 whitespace-normal">
                        <span className="font-medium text-brand-ink">{b.title}</span>
                        {b.subtitle ? <span className="block text-xs text-muted-foreground">{truncate(b.subtitle, 100)}</span> : null}
                      </TableCell>
                      <TableCell className="capitalize">{b.placement}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.startsAt || b.endsAt ? `${b.startsAt ? formatDate(b.startsAt) : "Now"} – ${b.endsAt ? formatDate(b.endsAt) : "no end"}` : "Always"}</TableCell>
                      <TableCell>
                        <Visible on={b.isActive} labels={["Active", "Off"]} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <BannerDialog
                          bannerId={id}
                          initial={{
                            placement: b.placement,
                            eyebrow: b.eyebrow,
                            title: b.title,
                            subtitle: b.subtitle,
                            ctaLabel: b.ctaLabel,
                            ctaHref: b.ctaHref,
                            imageUrl: b.imageUrl,
                            imageAlt: b.imageAlt,
                            theme: b.theme,
                            sortOrder: b.sortOrder,
                            isActive: b.isActive,
                            startsAt: toIstDateTimeInput(b.startsAt),
                            endsAt: toIstDateTimeInput(b.endsAt),
                          }}
                          trigger={<Button variant="ghost">Edit</Button>}
                        />
                        <DeleteButton kind="banner" id={id} label={b.title} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  } else if (tab === "faqs") {
    const faqs = await Faq.find().sort({ category: 1, sortOrder: 1 }).lean();
    const categories = [...new Set(faqs.map((f) => f.category))];
    body = (
      <>
        <div className="mb-4 flex justify-end">
          <FaqDialog initial={EMPTY_FAQ} categories={categories} trigger={<Button><Plus className="size-4" /> New question</Button>} />
        </div>
        {faqs.length === 0 ? (
          <EmptyState title="No questions yet" />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqs.map((f) => {
                  const id = f._id.toHexString();
                  return (
                    <TableRow key={id}>
                      <TableCell className="max-w-xl whitespace-normal">
                        <span className="font-medium text-brand-ink">{f.question}</span>
                        <span className="block text-xs text-muted-foreground">{truncate(f.answer, 140)}</span>
                      </TableCell>
                      <TableCell>{f.category}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Visible on={f.isPublished} labels={["Published", "Draft"]} />
                          {f.showOnHome ? <Badge variant="outline">Home</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <FaqDialog
                          faqId={id}
                          categories={categories}
                          initial={{ question: f.question, answer: f.answer, category: f.category, sortOrder: f.sortOrder, isPublished: f.isPublished, showOnHome: f.showOnHome }}
                          trigger={<Button variant="ghost">Edit</Button>}
                        />
                        <DeleteButton kind="faq" id={id} label={f.question} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  } else {
    const testimonials = await Testimonial.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
    body = (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">Only publish real feedback that customers agreed to share. Featured product reviews (from Reviews) also appear in this section of the home page.</p>
          <TestimonialDialog initial={EMPTY_TESTIMONIAL} trigger={<Button><Plus className="size-4" /> New testimonial</Button>} />
        </div>
        {testimonials.length === 0 ? (
          <EmptyState title="No testimonials yet" description="The store starts with none. Add them as genuine customer feedback comes in." />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testimonials.map((t) => {
                  const id = t._id.toHexString();
                  return (
                    <TableRow key={id}>
                      <TableCell className="max-w-xl text-sm whitespace-normal">“{truncate(t.quote, 160)}”</TableCell>
                      <TableCell>
                        {t.name}
                        {t.location ? <span className="block text-xs text-muted-foreground">{t.location}</span> : null}
                      </TableCell>
                      <TableCell>{t.consentConfirmed ? <Badge variant="outline">Confirmed</Badge> : <Badge variant="destructive">Missing</Badge>}</TableCell>
                      <TableCell>
                        <Visible on={t.isPublished && t.consentConfirmed} labels={["Published", "Hidden"]} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <TestimonialDialog
                          testimonialId={id}
                          initial={{ name: t.name, location: t.location, quote: t.quote, rating: t.rating, isPublished: t.isPublished, sortOrder: t.sortOrder, consentConfirmed: t.consentConfirmed }}
                          trigger={<Button variant="ghost">Edit</Button>}
                        />
                        <DeleteButton kind="testimonial" id={id} label={t.name} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title="Storefront content" description="Home page, banners, FAQs, testimonials and the announcement bar." />
      <nav aria-label="Content sections" className="mb-5 flex flex-wrap gap-1 rounded-xl border bg-white p-1 sm:w-fit">
        {(Object.entries(TABS) as [Tab, string][]).map(([key, label]) => (
          <Link
            key={key}
            href={key === "homepage" ? "/admin/content" : `/admin/content?tab=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", key === tab ? "bg-brand-green text-white" : "text-muted-foreground hover:bg-muted")}
          >
            {label}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}
