"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function FeedbackTabNav({ activeTab }: { activeTab: string }) {
  const searchParams = useSearchParams();
  const t = useTranslations("admin");

  const tabs = [
    { key: "feedbacks", label: t("feedback.tabs.feedbacks") },
    { key: "rubric", label: t("feedback.tabs.rubric") },
  ];

  return (
    <div className="border-border/70 flex gap-1 rounded-lg border bg-muted p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const params = new URLSearchParams();
        if (tab.key !== "feedbacks") {
          params.set("tab", tab.key);
        }
        // Preserve other params only for feedbacks tab
        if (tab.key === "feedbacks") {
          const status = searchParams.get("status");
          const search = searchParams.get("search");
          if (status) params.set("status", status);
          if (search) params.set("search", search);
        }
        const query = params.toString();
        const href = query ? `/admin/feedback?${query}` : "/admin/feedback";

        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
