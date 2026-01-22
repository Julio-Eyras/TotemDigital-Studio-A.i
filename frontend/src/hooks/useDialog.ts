/**
 * useDialog Hook - SmartSignage Pro v2.1
 * Hook para gerenciar estado de dialogs
 */

import { useState, useCallback } from 'react';

export interface UseDialogReturn {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  toggleDialog: () => void;
}

export function useDialog(initialOpen: boolean = false): UseDialogReturn {
  const [open, setOpen] = useState(initialOpen);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleDialog = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return {
    open,
    openDialog,
    closeDialog,
    toggleDialog,
  };
}
