import Link from "next/link";
import { isConfigured } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { SignOutButton } from "./SignOutButton";

const MEMBER = [
  { href: "/shops", label: "Shops", icon: "map" },
  { href: "/orders", label: "Order", icon: "cup" },
  { href: "/account", label: "Account", icon: "user" },
] as const;

const SHOP = [
  { href: "/shop/orders", label: "Orders", icon: "list" },
  { href: "/shop/redeem", label: "Scan", icon: "scan" },
  { href: "/shop/menu", label: "Menu", icon: "cup" },
  { href: "/shop", label: "Dashboard", icon: "chart" },
] as const;

export async function SiteHeader() {
  const session = isConfigured() ? await getSession().catch(() => null) : null;
  const role = session?.profile.role;
  const links = role === "shop_owner" ? SHOP : role ? MEMBER : [];

  return (
    <>
      <header className="sticky top-0 z-40 bg-vanilla-bean/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={session ? (role === "shop_owner" ? "/shop" : "/home") : "/"} aria-label="Sippy Brew home">
            <Logo size={44} />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} exact={l.href === "/shop"}>
                {l.label}
              </NavLink>
            ))}
            {role === "shop_owner" && (
              <>
                <NavLink href="/shop/payouts">Payouts</NavLink>
                <NavLink href="/shop/posts">Board</NavLink>
              </>
            )}
            {role === "admin" && <NavLink href="/admin">Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <SignOutButton />
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-full bg-espresso px-6 font-bold text-cream-swirl hover:bg-pecan"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom tabs, matching the native apps. */}
      {links.length > 0 && (
        <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 border-t border-latte bg-cream-swirl/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <ul className="mx-auto flex max-w-lg justify-around px-2 py-1.5">
            {links.map((l) => (
              <li key={l.href} className="flex-1">
                <NavLink href={l.href} exact={l.href === "/shop"} tab icon={l.icon}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
