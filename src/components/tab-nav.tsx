import Link from "next/link";

type TabKey = "life" | "work" | "reports";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "life", label: "生活" },
  { key: "work", label: "工作" },
  { key: "reports", label: "报告" },
];

export function TabNav({ currentTab }: { currentTab: TabKey }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/20 bg-white/70 backdrop-blur-xl md:top-6 md:bottom-auto md:left-auto md:right-6 md:w-auto md:rounded-3xl md:border md:shadow-2xl">
      <div className="mx-auto flex max-w-3xl items-center justify-around gap-2 px-4 py-4 md:max-w-none md:px-3 md:py-3">
        {tabs.map((tab, index) => {
          const active = tab.key === currentTab;

          return (
            <Link
              key={tab.key}
              href={`/?tab=${tab.key}`}
              className={`min-w-24 rounded-2xl px-5 py-3 text-center text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${
                active
                  ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/30"
                  : "text-slate-600 hover:text-violet-600 hover:bg-violet-50"
              }`}
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
