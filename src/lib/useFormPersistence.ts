import { useState, useEffect, useCallback, useRef } from "react";

interface FormData {
  [key: string]: unknown;
}

interface UIState {
  [key: string]: unknown;
}

const SAVE_DEBOUNCE_MS = 500;

export function useFormPersistence<
  T extends FormData,
  U extends UIState = Record<string, never>,
>(
  initialData: T,
  storageKey: string,
  _dependencies: unknown[] = [],
  initialUIState: U = {} as U,
) {
  const [formData, setFormData] = useState<T>(initialData);
  const [uiState, setUIState] = useState<U>(initialUIState);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(storageKey);
      const savedUIState = localStorage.getItem(`${storageKey}-ui`);

      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setFormData((prev) => ({ ...prev, ...parsedData }));
      }

      if (savedUIState) {
        const parsedUIState = JSON.parse(savedUIState);
        setUIState((prev) => ({ ...prev, ...parsedUIState }));
      }
    } catch (error) {
      console.error("Error loading form data from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // Debounced save form data to localStorage
  useEffect(() => {
    if (!isLoaded) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(formData));
      } catch (error) {
        console.error("Error saving form data to localStorage:", error);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [formData, storageKey, isLoaded]);

  // Debounced save UI state to localStorage
  useEffect(() => {
    if (!isLoaded) return;

    if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current);
    uiSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`${storageKey}-ui`, JSON.stringify(uiState));
      } catch (error) {
        console.error("Error saving UI state to localStorage:", error);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current);
    };
  }, [uiState, storageKey, isLoaded]);

  const updateFormData = useCallback((updates: Partial<T>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateUIState = useCallback((updates: Partial<U>) => {
    setUIState((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearFormData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}-ui`);
      setFormData(initialData);
      setUIState(initialUIState);
    } catch (error) {
      console.error("Error clearing form data:", error);
    }
  }, [storageKey, initialData, initialUIState]);

  const resetFormData = useCallback(() => {
    setFormData(initialData);
    setUIState(initialUIState);
  }, [initialData, initialUIState]);

  return {
    formData,
    uiState,
    updateFormData,
    updateUIState,
    clearFormData,
    resetFormData,
    isLoaded,
  };
}
