/**
 * useCommandPalette Hook
 * Hook para gerenciar Command Palette com atalho Ctrl+K / Cmd+K
 */

import { useState, useEffect } from 'react';
import { useDialog } from './useDialog';

export function useCommandPalette() {
  const { open, openDialog, closeDialog } = useDialog();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K ou Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          closeDialog();
        } else {
          openDialog();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, openDialog, closeDialog]);

  return {
    open,
    openDialog,
    closeDialog,
  };
}
