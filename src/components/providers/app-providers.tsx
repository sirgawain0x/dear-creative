"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PrivyBridgeContext, PrivyRootProvider } from "./privy-root-provider";
import { ToastProvider } from "@/components/ui/toast";

export const STUDIO_TOKEN_STORAGE_KEY = "dear_creative_studio_token";

function readStudioTokenFromStorage(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(STUDIO_TOKEN_STORAGE_KEY)?.trim() ?? "";
}

type StudioTokenContextValue = {
  studioToken: string;
  setStudioToken: (token: string) => void;
  clearStudioToken: () => void;
};

const StudioTokenContext = createContext<StudioTokenContextValue | null>(null);

export function useStudioToken(): StudioTokenContextValue {
  const value = useContext(StudioTokenContext);
  if (!value) {
    throw new Error("useStudioToken must be used within AppProviders");
  }
  return value;
}

export function StudioTokenProvider({ children }: { children: React.ReactNode }) {
  const [studioToken, setStudioTokenState] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStudioTokenState(readStudioTokenFromStorage());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setStudioToken = useCallback((token: string) => {
    const trimmed = token.trim();
    if (typeof window !== "undefined") {
      if (trimmed) {
        window.localStorage.setItem(STUDIO_TOKEN_STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(STUDIO_TOKEN_STORAGE_KEY);
      }
    }
    setStudioTokenState(trimmed);
  }, []);

  const clearStudioToken = useCallback(() => {
    setStudioToken("");
  }, [setStudioToken]);

  const value = useMemo(
    () => ({ studioToken, setStudioToken, clearStudioToken }),
    [studioToken, setStudioToken, clearStudioToken],
  );

  return (
    <StudioTokenContext.Provider value={value}>
      {children}
    </StudioTokenContext.Provider>
  );
}

export function useSafePrivy() {
  const privy = useContext(PrivyBridgeContext);
  const { privyConfigured, adamTokenConfigured, configLoaded } = useContext(
    AuthRuntimeConfigContext,
  );
  const [privyTimedOut, setPrivyTimedOut] = useState(false);

  const isPrivyMounted = Boolean(privy);
  const isPrivyReady = privy?.ready ?? false;

  useEffect(() => {
    if (!privyConfigured || !isPrivyMounted || isPrivyReady) {
      return;
    }
    const timer = setTimeout(() => {
      setPrivyTimedOut(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [privyConfigured, isPrivyMounted, isPrivyReady]);

  const isTimedOut = Boolean(privyConfigured && !isPrivyReady && privyTimedOut);
  const ready = privyConfigured
    ? isPrivyReady || isTimedOut
    : configLoaded || true;

  const noopLogin = useCallback(() => {}, []);
  const noopLogout = useCallback(async () => {}, []);
  const nullAccessToken = useCallback(async () => null, []);

  return {
    ready,
    authenticated: privy?.authenticated ?? false,
    user: privy?.user ?? null,
    login: privy?.login ?? noopLogin,
    logout: privy?.logout ?? noopLogout,
    getAccessToken: privy?.getAccessToken ?? nullAccessToken,
    privyConfigured,
    adamTokenConfigured,
    configLoaded,
    privyTimedOut: isTimedOut,
  };
}

/**
 * Returns true if the user is authenticated either via Privy or using a Studio Key (ADAM_API_TOKEN).
 */
export function useAuthSession() {
  const privy = useSafePrivy();
  const { studioToken, setStudioToken, clearStudioToken } = useStudioToken();

  const hasStudioToken = Boolean(studioToken.trim());
  const isSignedIn = privy.authenticated || hasStudioToken;

  const handleSignOut = async () => {
    clearStudioToken();
    if (privy.authenticated) {
      await privy.logout();
    }
  };

  return {
    ...privy,
    isSignedIn,
    hasStudioToken,
    studioToken,
    setStudioToken,
    clearStudioToken,
    signOut: handleSignOut,
  };
}

type AuthRuntimeConfig = {
  privyConfigured: boolean;
  adamTokenConfigured: boolean;
  configLoaded: boolean;
};

const AuthRuntimeConfigContext = createContext<AuthRuntimeConfig>({
  privyConfigured: false,
  adamTokenConfigured: false,
  configLoaded: false,
});

type AppProvidersProps = {
  privyAppId?: string;
  children: React.ReactNode;
};

export function AppProviders({ privyAppId, children }: AppProvidersProps) {
  const [runtimeAppId, setRuntimeAppId] = useState<string | undefined>(
    privyAppId?.trim() || undefined,
  );
  const [adamTokenConfigured, setAdamTokenConfigured] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(Boolean(privyAppId?.trim()));

  useEffect(() => {
    let cancelled = false;
    async function fetchConfig() {
      try {
        const res = await fetch("/api/admin/config", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          privyAppId?: string | null;
          privyConfigured?: boolean;
          adamTokenConfigured?: boolean;
        };
        if (cancelled) return;
        if (data.privyAppId?.trim()) {
          setRuntimeAppId((prev) => prev || data.privyAppId!.trim());
        }
        setAdamTokenConfigured(Boolean(data.adamTokenConfigured));
      } catch {
        // Ignore network errors and proceed with static config
      } finally {
        if (!cancelled) {
          setConfigLoaded(true);
        }
      }
    }
    void fetchConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedAppId = privyAppId?.trim() || runtimeAppId;
  const contextValue = useMemo<AuthRuntimeConfig>(
    () => ({
      privyConfigured: Boolean(resolvedAppId),
      adamTokenConfigured,
      configLoaded,
    }),
    [resolvedAppId, adamTokenConfigured, configLoaded],
  );

  if (!resolvedAppId) {
    return (
      <AuthRuntimeConfigContext.Provider value={contextValue}>
        <StudioTokenProvider>
          <ToastProvider>{children}</ToastProvider>
        </StudioTokenProvider>
      </AuthRuntimeConfigContext.Provider>
    );
  }

  return (
    <AuthRuntimeConfigContext.Provider value={contextValue}>
      <StudioTokenProvider>
        <PrivyRootProvider appId={resolvedAppId}>
          <ToastProvider>{children}</ToastProvider>
        </PrivyRootProvider>
      </StudioTokenProvider>
    </AuthRuntimeConfigContext.Provider>
  );
}

