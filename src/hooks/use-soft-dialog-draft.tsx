"use client";

import { useCallback, useRef, useState } from "react";

/** In-memory only: dies on refresh / leaving the page. */
export function softDialogDraftKey(scope: string, entityId?: string | null): string {
  return entityId ? `${scope}:${entityId}` : `${scope}:new`;
}

export function snapshotsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type SoftDialogDraftEnvelope<T> = {
  values: T;
  baseline: T;
};

export function UnsavedDialogDraftHint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 mt-2">
      有未儲存內容
    </p>
  );
}

export function useSoftDialogDraft<T>() {
  const draftsRef = useRef(new Map<string, T>());

  const getDraft = useCallback((key: string) => draftsRef.current.get(key), []);

  const setDraft = useCallback((key: string, value: T) => {
    draftsRef.current.set(key, value);
  }, []);

  const clearDraft = useCallback((key: string) => {
    draftsRef.current.delete(key);
  }, []);

  return { getDraft, setDraft, clearDraft };
}

export function useSoftDialogSession<T>(scope: string, entityId?: string | null) {
  const { getDraft, setDraft, clearDraft } =
    useSoftDialogDraft<SoftDialogDraftEnvelope<T>>();
  const draftKey = softDialogDraftKey(scope, entityId);
  const [hydrateReady, setHydrateReady] = useState(false);
  const [showUnsavedHint, setShowUnsavedHint] = useState(false);
  const skipDismissPersistRef = useRef(false);
  const baselineRef = useRef<T | null>(null);
  const userEditedRef = useRef(false);

  const markUserEdited = useCallback(() => {
    userEditedRef.current = true;
  }, []);

  const syncDraft = useCallback(
    (values: T) => {
      if (!hydrateReady) return;
      if (!baselineRef.current) {
        baselineRef.current = values;
        return;
      }
      if (!userEditedRef.current) {
        baselineRef.current = values;
        return;
      }
      if (snapshotsEqual(values, baselineRef.current)) {
        clearDraft(draftKey);
      } else {
        setDraft(draftKey, { values, baseline: baselineRef.current });
      }
    },
    [hydrateReady, draftKey, setDraft, clearDraft],
  );

  const beginFreshHydrate = useCallback(() => {
    baselineRef.current = null;
    userEditedRef.current = false;
    setShowUnsavedHint(false);
    setHydrateReady(false);
  }, []);

  const finishHydrate = useCallback(() => {
    setHydrateReady(true);
  }, []);

  const applyRestoredDraft = useCallback(
    (apply: (values: T) => void) => {
      const existing = getDraft(draftKey);
      if (!existing) return false;
      apply(existing.values);
      baselineRef.current = existing.baseline;
      userEditedRef.current = true;
      setShowUnsavedHint(true);
      setHydrateReady(true);
      return true;
    },
    [getDraft, draftKey],
  );

  const handleDismiss = useCallback(
    (values: T, onClose: () => void) => {
      if (skipDismissPersistRef.current) {
        skipDismissPersistRef.current = false;
        onClose();
        return;
      }
      if (hydrateReady) syncDraft(values);
      setHydrateReady(false);
      onClose();
    },
    [hydrateReady, syncDraft],
  );

  const handleCancel = useCallback(
    (onClose: () => void) => {
      skipDismissPersistRef.current = true;
      clearDraft(draftKey);
      baselineRef.current = null;
      userEditedRef.current = false;
      setShowUnsavedHint(false);
      setHydrateReady(false);
      onClose();
    },
    [clearDraft, draftKey],
  );

  const handleSavedClose = useCallback(
    (onClose: () => void) => {
      skipDismissPersistRef.current = true;
      clearDraft(draftKey);
      baselineRef.current = null;
      userEditedRef.current = false;
      setShowUnsavedHint(false);
      setHydrateReady(false);
      onClose();
    },
    [clearDraft, draftKey],
  );

  return {
    draftKey,
    hydrateReady,
    showUnsavedHint,
    markUserEdited,
    syncDraft,
    beginFreshHydrate,
    finishHydrate,
    applyRestoredDraft,
    handleDismiss,
    handleCancel,
    handleSavedClose,
  };
}
