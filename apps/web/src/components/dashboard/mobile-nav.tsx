"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/providers/auth-provider";
import { isActive, navigationFor } from "./navigation";

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="border-b border-slate-200 bg-white p-3 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700"
        aria-expanded={open}
      >
        <Menu size={18} />
        Menu
      </button>

      {open && (
        <nav className="mt-3 space-y-1">
          {navigationFor(user.role).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm ${
                isActive(pathname, link.href)
                  ? "bg-red-50 text-red-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
