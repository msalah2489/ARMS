"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";

type PendingLeave = {
  action: () => void;
  onDiscard?: () => void;
};

type ConfirmIfDirtyOptions = {
  onDiscard?: () => void;
  /** When set, only this scope blocks; otherwise any dirty scope blocks. */
  scope?: string;
};

type UnsavedChangesContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean, scope?: string) => void;
  markDirty: (scope?: string) => void;
  clearDirty: (scope?: string) => void;
  clearAllDirty: () => void;
  /**
   * If dirty (optionally scoped), open the Arabic modal.
   * نعم → cancel; لا → run onDiscard (optional) then action.
   */
  confirmIfDirty: (action: () => void, options?: ConfirmIfDirtyOptions) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

const DEFAULT_SCOPE = "default";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isInternalAppHref(href: string): URL | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url;
  } catch {
    return null;
  }
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const scopesRef = useRef(new Set<string>());
  const [isDirty, setIsDirty] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingRef = useRef<PendingLeave | null>(null);
  const isDirtyRef = useRef(false);

  const syncDirty = useCallback(() => {
    const next = scopesRef.current.size > 0;
    isDirtyRef.current = next;
    setIsDirty(next);
  }, []);

  const setDirty = useCallback(
    (dirty: boolean, scope: string = DEFAULT_SCOPE) => {
      if (dirty) scopesRef.current.add(scope);
      else scopesRef.current.delete(scope);
      syncDirty();
    },
    [syncDirty],
  );

  const markDirty = useCallback(
    (scope: string = DEFAULT_SCOPE) => setDirty(true, scope),
    [setDirty],
  );

  const clearDirty = useCallback(
    (scope: string = DEFAULT_SCOPE) => setDirty(false, scope),
    [setDirty],
  );

  const clearAllDirty = useCallback(() => {
    scopesRef.current.clear();
    syncDirty();
  }, [syncDirty]);

  const confirmIfDirty = useCallback(
    (action: () => void, options?: ConfirmIfDirtyOptions) => {
      const blocked = options?.scope
        ? scopesRef.current.has(options.scope)
        : isDirtyRef.current;
      if (!blocked) {
        action();
        return;
      }
      pendingRef.current = { action, onDiscard: options?.onDiscard };
      setDialogOpen(true);
    },
    [],
  );

  const stay = useCallback(() => {
    setDialogOpen(false);
    pendingRef.current = null;
  }, []);

  const discardAndLeave = useCallback(() => {
    setDialogOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    // Callers clear their own scope(s) inside onDiscard / action.
    // Link interception clears all scopes before navigating.
    pending?.onDiscard?.();
    pending?.action();
  }, []);

  // Native browser guard on refresh / close / external navigation.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Intercept in-app <a> / Link clicks while dirty.
  useEffect(() => {
    if (!isDirty) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = isInternalAppHref(anchor.getAttribute("href") ?? "");
      if (!url) return;

      const current = new URL(window.location.href);
      if (
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash !== current.hash
      ) {
        return;
      }
      if (
        url.pathname === current.pathname &&
        url.search === current.search &&
        !url.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const href = `${url.pathname}${url.search}${url.hash}`;
      confirmIfDirty(() => {
        clearAllDirty();
        router.push(href);
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty, confirmIfDirty, clearAllDirty, router]);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      isDirty,
      setDirty,
      markDirty,
      clearDirty,
      clearAllDirty,
      confirmIfDirty,
    }),
    [isDirty, setDirty, markDirty, clearDirty, clearAllDirty, confirmIfDirty],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={dialogOpen}
        onConfirmStay={stay}
        onDiscardAndLeave={discardAndLeave}
      />
    </UnsavedChangesContext.Provider>
  );
}

/**
 * @param scope Isolate dirty flags (e.g. page vs nested modal) so clearing one
 * does not wipe another still-editing surface.
 */
export function useUnsavedChanges(scope: string = DEFAULT_SCOPE) {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }

  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const { setDirty: setDirtyScoped, markDirty: markDirtyScoped, clearDirty: clearDirtyScoped } =
    ctx;

  const setDirty = useCallback(
    (dirty: boolean) => setDirtyScoped(dirty, scopeRef.current),
    [setDirtyScoped],
  );
  const markDirty = useCallback(
    () => markDirtyScoped(scopeRef.current),
    [markDirtyScoped],
  );
  const clearDirty = useCallback(
    () => clearDirtyScoped(scopeRef.current),
    [clearDirtyScoped],
  );

  useEffect(() => {
    const activeScope = scope;
    return () => {
      clearDirtyScoped(activeScope);
    };
  }, [clearDirtyScoped, scope]);

  const confirmIfDirtyFn = ctx.confirmIfDirty;
  const confirmIfDirty = useCallback(
    (action: () => void, options?: Omit<ConfirmIfDirtyOptions, "scope">) =>
      confirmIfDirtyFn(action, { ...options, scope: scopeRef.current }),
    [confirmIfDirtyFn],
  );

  return {
    isDirty: ctx.isDirty,
    setDirty,
    markDirty,
    clearDirty,
    clearAllDirty: ctx.clearAllDirty,
    confirmIfDirty,
  };
}
