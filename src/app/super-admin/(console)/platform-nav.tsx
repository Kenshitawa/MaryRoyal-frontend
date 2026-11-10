"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, PlusCircle } from "lucide-react";

const links = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/schools/new", label: "Add school", icon: PlusCircle, exact: false },
];

export default function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Platform" className="-mb-px flex gap-1 overflow-x-auto">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              active
                ? "border-teal-400 text-white"
                : "border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-100"
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
      <span className="ml-auto hidden items-center gap-1.5 py-2.5 text-[10px] font-medium uppercase tracking-[.14em] text-slate-500 sm:inline-flex">
        <Building2 size={13} aria-hidden="true" /> Tenant management
      </span>
    </nav>
  );
}
