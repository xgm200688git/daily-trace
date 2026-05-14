import Link from "next/link";

type TabKey = "life" | "work" | "reports";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "life", label: "生活" },
  { key: "work", label: "工作" },
  { key: "reports", label: "报告" },
];

export function TabNav({ currentTab }: { currentTab: TabKey }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-[rgba(247,244,238,0.94)] backdrop-blur md:top-6 md:bottom-auto md:left-auto md:right-6 md:w-auto md:rounded-full md:border">
      <div className="mx-auto flex max-w-3xl items-center justify-around gap-2 px-4 py-3 md:max-w-none md:px-2 md:py-2">
        {tabs.map((tab) => {
          const active = tab.key === currentTab;

          return (
            <Link
              key={tab.key}
              href={`/?tab=${tab.key}`}
              className={`min-w-20 rounded-full px-4 py-2 text-center text-sm font-medium transition ${
                active
                  ? "bg-stone-900 text-stone-50 shadow-sm"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
