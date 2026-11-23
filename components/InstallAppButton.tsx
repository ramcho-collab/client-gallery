"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton() {
  const pathname = usePathname();
  const prevAdminRef = useRef<boolean | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prevAdminRef.current !== null && prevAdminRef.current !== isAdminRoute) {
      window.location.assign(pathname || "/");
      return;
    }
    prevAdminRef.current = isAdminRoute;

    const manifestHref = isAdminRoute ? "/admin/manifest.webmanifest" : "/manifest.webmanifest";
    let linkEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.rel = "manifest";
      document.head.appendChild(linkEl);
    }
    if (linkEl.href !== `${window.location.origin}${manifestHref}`) {
      linkEl.href = manifestHref;
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(standalone);

    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowHelp(false);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isAdminRoute, pathname]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }

    setShowHelp((prev) => !prev);
  };

  return (
    <>
      {isAdminRoute && (
        <div
          aria-hidden="true"
          style={{ zIndex: -5 }}
          className="fixed inset-0 bg-neutral-950 pointer-events-none"
        />
      )}

      {!isInstalled && (
        <div className="mt-3 flex flex-col items-center">
          <button
            type="button"
            onClick={handleInstallClick}
            className="rounded-lg bg-white px-4 py-1.5 text-xs sm:text-sm font-semibold text-neutral-900 hover:bg-white/85 transition shadow-md"
          >
            {isAdminRoute ? "Install Admin App" : "Install App"}
          </button>
          {showHelp && (
            <p className="mt-2 text-xs text-white bg-neutral-900 border border-white/20 px-3 py-1.5 rounded-lg max-w-xs">
              {isIos
                ? 'Tap Share in Safari, then tap "Add to Home Screen".'
                : 'Open your browser menu (⋮) and tap "Install app" or "Add to Home Screen".'}
            </p>
          )}
        </div>
      )}
    </>
  );
}
