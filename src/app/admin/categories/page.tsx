import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { deleteCategoryAction } from "@/app/admin/products/actions";
import { ActionButton } from "@/components/admin/action-button";
import { CategoryDialog } from "@/components/admin/products/category-dialog";
import { AdminPageHeader, EmptyState } from "@/components/admin/ui";
import { ProductImage } from "@/components/shared/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffPage } from "@/lib/auth/session";
import { categoryOptions } from "@/lib/admin/products";
import { Category, connectDB, Product } from "@/lib/db";
import type { CategoryInput } from "@/lib/validation/product";

export const metadata: Metadata = { title: "Categories" };

const EMPTY: CategoryInput = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
  imageUrl: "",
  imageAlt: "",
  sortOrder: 0,
  isActive: true,
  showOnHome: true,
  seoTitle: "",
  seoDescription: "",
};

export default async function CategoriesPage() {
  await requireStaffPage("categories:write", "/admin/categories");
  await connectDB();
  const [options, docs, counts] = await Promise.all([
    categoryOptions(),
    Category.find().lean(),
    Product.aggregate<{ _id: unknown; count: number }>([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
  ]);
  const byId = new Map(docs.map((d) => [d._id.toHexString(), d]));
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="Organise products into categories and sub-categories."
        actions={
          <CategoryDialog
            initial={EMPTY}
            parents={options}
            trigger={
              <Button>
                <Plus className="size-4" /> New category
              </Button>
            }
          />
        }
      />
      {options.length === 0 ? (
        <EmptyState title="No categories yet" description="Create categories such as Kitchen Care or Car Care." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((option) => {
                const c = byId.get(option.id)!;
                const initial: CategoryInput = {
                  name: c.name,
                  slug: c.slug,
                  description: c.description,
                  parentId: c.parent?.toHexString() ?? "",
                  imageUrl: c.image?.url ?? "",
                  imageAlt: c.image?.alt ?? "",
                  sortOrder: c.sortOrder,
                  isActive: c.isActive,
                  showOnHome: c.showOnHome,
                  seoTitle: c.seo?.title ?? "",
                  seoDescription: c.seo?.description ?? "",
                };
                return (
                  <TableRow key={option.id}>
                    <TableCell>
                      <div className="flex items-center gap-3" style={{ paddingLeft: option.depth * 20 }}>
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-brand-mint">
                          {c.image?.url ? <ProductImage src={c.image.url} alt="" fill sizes="40px" className="object-cover" /> : null}
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">/categories/{c.slug}</TableCell>
                    <TableCell className="tabular-nums">{countMap.get(option.id) ?? 0}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? "Visible" : "Hidden"}</Badge>
                      {c.showOnHome ? <Badge variant="outline">Home</Badge> : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <CategoryDialog
                          categoryId={option.id}
                          initial={initial}
                          parents={options}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          }
                        />
                        <ActionButton
                          action={deleteCategoryAction.bind(null, option.id)}
                          variant="ghost"
                          className="text-destructive"
                          confirm={{ title: `Delete ${c.name}?`, description: "Only empty categories without sub-categories can be deleted." }}
                          confirmLabel="Delete"
                        >
                          Delete
                        </ActionButton>
                      </div>
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
