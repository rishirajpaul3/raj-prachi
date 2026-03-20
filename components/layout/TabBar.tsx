"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface TabBarProps {
  tabs: Tab[];
}

export function TabBar({ tabs }: TabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around px-4 z-50"
      role="navigation"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors min-w-[44px] min-h-[44px] justify-center",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isActive
                ? "text-amber-600 focus-visible:ring-amber-500"
                : "text-gray-500 hover:text-gray-700 focus-visible:ring-gray-400"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="relative">
              {tab.icon}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center"
                  aria-label={`${tab.badge} unread`}
                >
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
