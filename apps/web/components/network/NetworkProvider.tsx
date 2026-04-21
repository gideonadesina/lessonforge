"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NetworkStatus = "online" | "offline" | "unstable";

type NetworkContextValue = {
  isOnline: boolean;
  isUnstable: boolean;
  status: NetworkStatus;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);
const FETCH_WRAPPED_FLAG = "__LF_NETWORK_FETCH_WRAPPED__";
const ORIGINAL_FETCH_KEY = "__LF_NETWORK_ORIGINAL_FETCH__";

export function useNetworkStatus() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetworkStatus must be used inside NetworkProvider");
  return ctx;
}

const OFFLINE_MESSAGE = "You’re offline. Reconnecting…";
const UNSTABLE_MESSAGE = "Connection unstable. Trying to continue…";
const BACK_ONLINE_MESSAGE = "Back online. Resuming…";

const NETWORK_TIMEOUT_MS = 20000;
const STALLED_REQUEST_MS = 12000;

function mergeSignal(signalA?: AbortSignal | null, signalB?: AbortSignal): AbortSignal | undefined {
  if (!signalA) return signalB;
  if (!signalB) return signalA;

  const controller = new AbortController();

  const forwardAbort = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  signalA.addEventListener("abort", forwardAbort, { once: true });
  signalB.addEventListener("abort", forwardAbort, { once: true });

  return controller.signal;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [status, setStatus] = useState<NetworkStatus>("online");
  const [bannerMessage, setBannerMessage] = useState<string>("");
  const [showBanner, setShowBanner] = useState(false);

  const statusRef = useRef<NetworkStatus>("online");
  const networkFailureRef = useRef({ count: 0, lastTime: 0 });
  const hideTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const showNetworkBanner = useCallback((message: string, persist = false) => {
    if (!mountedRef.current) return;
    setBannerMessage(message);
    setShowBanner(true);
    if (hideTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!persist && typeof window !== "undefined") {
      hideTimerRef.current = window.setTimeout(() => {
        setShowBanner(false);
      }, 4000);
    }
  }, []);

  const setNetworkStatus = useCallback((nextStatus: NetworkStatus) => {
    if (statusRef.current === nextStatus) return;
    statusRef.current = nextStatus;
    setStatus(nextStatus);

    if (nextStatus === "offline") {
      setIsOnline(false);
      showNetworkBanner(OFFLINE_MESSAGE, true);
    } else if (nextStatus === "unstable") {
      setIsOnline(true);
      showNetworkBanner(UNSTABLE_MESSAGE, true);
    } else {
      setIsOnline(true);
      showNetworkBanner(BACK_ONLINE_MESSAGE, false);
    }
  }, [showNetworkBanner]);

  const reportSuccess = useCallback(() => {
    networkFailureRef.current = { count: 0, lastTime: 0 };
    if (statusRef.current !== "online") {
      setNetworkStatus("online");
    }
  }, [setNetworkStatus]);

  const reportFailure = useCallback((forceUnstable = false) => {
    const now = Date.now();
    const previous = networkFailureRef.current;
    const isRecent = now - previous.lastTime < 30000;
    const count = isRecent ? previous.count + 1 : 1;

    networkFailureRef.current = {
      count,
      lastTime: now,
    };

    if (!navigator.onLine) {
      setNetworkStatus("offline");
      return;
    }

    const shouldMarkUnstable =
      forceUnstable || (count >= 2 && previous.lastTime > 0 && isRecent);

    if (shouldMarkUnstable) {
      setNetworkStatus("unstable");
    }
  }, [setNetworkStatus]);

  useEffect(() => {
    setMounted(true);
    mountedRef.current = true;

    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setNetworkStatus("online");
    };

    const handleOffline = () => {
      setNetworkStatus("offline");
    };

    if (!navigator.onLine) {
      setNetworkStatus("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (hideTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [setNetworkStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as any;

    if (win[FETCH_WRAPPED_FLAG]) return;

    const originalFetch = window.fetch.bind(window);
    win[ORIGINAL_FETCH_KEY] = originalFetch;
    win[FETCH_WRAPPED_FLAG] = true;

    const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
      const mergedSignal = mergeSignal(init?.signal ?? undefined, controller.signal);
      const finalInit = { ...init, signal: mergedSignal };
      let stalledId: number | null = window.setTimeout(() => {
        reportFailure(true);
      }, STALLED_REQUEST_MS);

      try {
        const response = await originalFetch(input, finalInit);
        if (stalledId) {
          window.clearTimeout(stalledId);
          stalledId = null;
        }
        window.clearTimeout(timeoutId);

        if (!response.ok) {
          const unstableCodes = [0, 502, 503, 504];
          if (unstableCodes.includes(response.status)) {
            reportFailure(false);
          } else {
            reportSuccess();
          }
        } else {
          reportSuccess();
        }

        return response;
      } catch (error: any) {
        if (stalledId) {
          window.clearTimeout(stalledId);
          stalledId = null;
        }
        window.clearTimeout(timeoutId);

        if (error?.name === "AbortError") {
          reportFailure(true);
        } else if (!navigator.onLine) {
          reportFailure(false);
        } else {
          reportFailure(true);
        }

        throw error;
      }
    };

    window.fetch = patchedFetch as typeof window.fetch;

    return () => {
      if (win[ORIGINAL_FETCH_KEY]) {
        window.fetch = win[ORIGINAL_FETCH_KEY];
        delete win[ORIGINAL_FETCH_KEY];
      }
      delete win[FETCH_WRAPPED_FLAG];
    };
  }, [reportFailure, reportSuccess]);

  const value = useMemo(
    () => ({ isOnline, isUnstable: status === "unstable", status }),
    [isOnline, status]
  );

  return (
    <NetworkContext.Provider value={value}>
      {children}

      {mounted && (
        <div className="fixed right-5 top-20 z-50 max-w-xs rounded-2xl border px-4 py-3 shadow-lg transition-all duration-300"
          style={{
            opacity: showBanner ? 1 : 0,
            pointerEvents: showBanner ? "auto" : "none",
            transform: showBanner ? "translateY(0)" : "translateY(-10px)",
            backgroundColor:
              status === "offline"
                ? "#f8d7da"
                : status === "unstable"
                ? "#fff4e5"
                : "#e6ffed",
            borderColor:
              status === "offline"
                ? "#f5c6cb"
                : status === "unstable"
                ? "#ffe6a3"
                : "#a3f7bf",
          }}
        >
          <div className="text-sm font-semibold"
            style={{ color: status === "offline" ? "#842029" : status === "unstable" ? "#7a5700" : "#0f5132" }}
          >
            {bannerMessage}
          </div>
        </div>
      )}
    </NetworkContext.Provider>
  );
}
