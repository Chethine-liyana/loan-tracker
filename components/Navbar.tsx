"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard", label: "Loans", emoji: "🏦" },
  { href: "/budget", label: "Budget", emoji: "💰" },
];

export default function Navbar({ email }: { email: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30
                    dark:bg-gray-900 dark:border-gray-700">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
        <div className="flex items-center gap-1 min-w-0">
          {NAV_LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                  active
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800/60"
                }`}
              >
                <span>{link.emoji}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 truncate max-w-[160px]">
            {email}
          </span>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="btn-secondary text-sm px-3 py-1.5"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
