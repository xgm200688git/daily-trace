"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosSafari() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(navigatorWithStandalone.standalone)
  );
}

export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standaloneTimer = window.setTimeout(() => {
      setInstalled(isStandalone());
    }, 0);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.clearTimeout(standaloneTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
        已安装
      </span>
    );
  }

  if (promptEvent) {
    return (
      <button
        type="button"
        className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-black/20 hover:text-black"
        onClick={async () => {
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice.outcome !== "dismissed") {
            setPromptEvent(null);
          }
        }}
      >
        安装到手机
      </button>
    );
  }

  if (isIosSafari()) {
    return (
      <div className="relative">
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-black/20 hover:text-black"
          onClick={() => setShowIosHelp((value) => !value)}
        >
          安装到手机
        </button>
        {showIosHelp ? (
          <div className="absolute right-0 top-9 z-30 w-64 rounded-2xl border border-black/10 bg-white p-4 text-xs leading-6 text-stone-600 shadow-xl">
            在 Safari 中点分享按钮，然后选择“添加到主屏幕”。
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
