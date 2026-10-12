"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/components/store/cart-context";
import { authClient, useSession } from "@/lib/auth/client";
import { isStaffRole } from "@/lib/domain/roles";
import { cn } from "@/lib/utils";

interface NavCategory {
  name: string;
  slug: string;
  description: string;
}

const PRIMARY_LINKS = [
  { href: "/shop", label: "Shop all" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function NavLinks({ categories }: { categories: NavCategory[] }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-mint data-[state=open]:bg-brand-mint">
          Categories <ChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[22rem] p-2">
          {categories.map((c) => (
            <DropdownMenuItem key={c.slug} asChild className="items-start rounded-lg p-3">
              <Link href={`/categories/${c.slug}`}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-brand-ink">{c.name}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{c.description}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {PRIMARY_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-mint"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function SearchForm({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    onDone?.();
  };
  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id="site-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search dishwash, floor cleaner…"
        className="h-10 rounded-full bg-muted/60 pl-9"
        autoFocus={autoFocus}
        maxLength={80}
      />
    </form>
  );
}

export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hidden w-56 xl:block xl:w-64">
        <SearchForm />
      </div>
      <Button variant="ghost" size="icon-lg" className="rounded-full xl:hidden" onClick={() => setOpen(true)} aria-label="Search products">
        <Search className="size-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 translate-y-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Search Ovelia</DialogTitle>
          </DialogHeader>
          <SearchForm onDone={() => setOpen(false)} autoFocus />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WishlistLink() {
  return (
    <Button variant="ghost" size="icon-lg" className="hidden rounded-full sm:inline-flex" asChild>
      <Link href="/account/wishlist" aria-label="Wishlist">
        <Heart className="size-5" />
      </Link>
    </Button>
  );
}

export function AccountMenu() {
  const { data, isPending } = useSession();
  const router = useRouter();
  if (isPending) return <div className="size-10 animate-pulse rounded-full bg-muted" aria-hidden />;
  if (!data) {
    return (
      <Button variant="ghost" size="icon-lg" className="rounded-full" asChild>
        <Link href="/login" aria-label="Sign in">
          <User className="size-5" />
        </Link>
      </Button>
    );
  }
  const user = data.user;
  const signOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Account menu">
          <span className="grid size-8 place-items-center rounded-full bg-brand-green text-sm font-bold text-white">
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-semibold">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User className="size-4" /> My account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/orders">
            <Package className="size-4" /> Orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/addresses">
            <MapPin className="size-4" /> Addresses
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/wishlist">
            <Heart className="size-4" /> Wishlist
          </Link>
        </DropdownMenuItem>
        {isStaffRole(user.role) ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <LayoutDashboard className="size-4" /> Admin dashboard
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CartButton() {
  const { cart, ready, setDrawerOpen } = useCart();
  const count = cart.itemCount;
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="relative rounded-full"
      onClick={() => setDrawerOpen(true)}
      aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <ShoppingBag className="size-5" />
      {ready && count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brand-teal px-1 text-[11px] leading-5 font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  );
}

export function MobileNav({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);
  const { data } = useSession();
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle asChild>
            <div>
              <Logo />
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-3 py-2">
          {PRIMARY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={close} className="rounded-lg px-3 py-3 text-base font-semibold text-brand-ink hover:bg-brand-mint">
              {link.label}
            </Link>
          ))}
          <p className="mt-3 px-3 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Categories</p>
          {categories.map((c) => (
            <Link key={c.slug} href={`/categories/${c.slug}`} onClick={close} className="rounded-lg px-3 py-2.5 text-[15px] text-brand-ink hover:bg-brand-mint">
              {c.name}
            </Link>
          ))}
          <p className="mt-3 px-3 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Help</p>
          <Link href="/track-order" onClick={close} className="rounded-lg px-3 py-2.5 text-[15px] hover:bg-brand-mint">
            Track order
          </Link>
          <Link href="/faq" onClick={close} className="rounded-lg px-3 py-2.5 text-[15px] hover:bg-brand-mint">
            FAQs
          </Link>
          <Link href={data ? "/account" : "/login"} onClick={close} className="rounded-lg px-3 py-2.5 text-[15px] hover:bg-brand-mint">
            {data ? "My account" : "Sign in / Register"}
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
