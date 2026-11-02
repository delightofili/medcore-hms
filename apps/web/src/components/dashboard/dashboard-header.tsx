"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";

export function DashboardHeader() {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div>
        <p className="text-sm text-slate-500">Welcome back,</p>
        <h1 className="font-semibold text-slate-900">
          {user?.firstName ?? "User"}
        </h1>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </header>
  );
}
