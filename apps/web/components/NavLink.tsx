"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./ui";

const ICONS: Record<string, ReactNode> = {
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" />,
  cup: <path d="M4 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Zm12 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3m4-3v3" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  scan: <path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3M7 12h10" />,
  chart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H3" />,
};

/** Active state uses a Sky Blue pill behind Espresso text (7.9:1), never Sky Blue text on light. */
export function NavLink({ href, children, exact, tab, icon }: { href: string; children: ReactNode; exact?: boolean; tab?: boolean; icon?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  if (tab) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-extrabold text-espresso"
      >
        <span className={cx("grid h-8 w-14 place-items-center rounded-full transition-colors", active && "bg-sky-blue")}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icon ? ICONS[icon] : null}
          </svg>
        </span>
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx("rounded-full px-4 py-2 font-bold text-espresso transition-colors hover:bg-latte/60", active && "bg-sky-blue hover:bg-sky-blue")}
    >
      {children}
    </Link>
  );
}
