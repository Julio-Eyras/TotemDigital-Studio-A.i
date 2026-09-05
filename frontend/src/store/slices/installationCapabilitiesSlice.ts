/**
 * installationCapabilitiesSlice — 4º slice Redux (Sprint 2)
 *
 * Substitui o <InstallationCapabilitiesContext /> (React Context).
 *
 * Motivos:
 *  - Persistência via redux-persist (já configurado no store)
 *  - Timeline / DevTools — podemos ver a ação de fetch de capabilities
 *  - Middleware compat (ex: se precisar invalidar por role)
 *  - Acesso em QUALQUER lugar da aplicação (mesmo fora de árvore React) via store.getState()
 *  - Mantemos hook compatível: useInstallationCapabilities() (ainda funciona)
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { dashboardApi } from '../../services/api';
import {
  defaultInstallationCapabilities,
  InstallationCapabilities,
} from '../../types/installationCapabilities';
import { setInstallationCapabilities as setGlobalCapabilitiesModuleVar } from '../../config/installationCapabilities';

// =================================================================
// STATE
// =================================================================

export interface InstallationCapabilitiesState {
  /** Objeto de capabilities carregado. Defaults são aplicados no bootstrap. */
  capabilities: InstallationCapabilities;
  /** `true` depois que o primeiro fetch bem-sucedido OU fallback rodou. */
  isReady: boolean;
  /** Estado do fetch atual. */
  isLoading: boolean;
  /** Último erro (null = ok). */
  error: string | null;
}

const initialState: InstallationCapabilitiesState = {
  capabilities: defaultInstallationCapabilities(),
  isReady: false,
  isLoading: false,
  error: null,
};

// =================================================================
// THUNK
// =================================================================

/**
 * Fetch /api/dashboard/ui-context -> capabilities.
 * Não falha hard: cai para defaults com aviso no console/state.error.
 */
export const fetchInstallationCapabilities = createAsyncThunk<
  InstallationCapabilities,
  { enabled?: boolean } | void,
  { rejectValue: string }
>(
  'installationCapabilities/fetch',
  async (opts, { rejectWithValue }) => {
    const enabled = opts?.enabled !== false;
    if (!enabled) {
      return defaultInstallationCapabilities();
    }
    try {
      const ctx = await dashboardApi.getUiContext();
      const caps: InstallationCapabilities = {
        ...defaultInstallationCapabilities(),
        ...(ctx.capabilities ?? {}),
      };
      // Sincroniza a variável module-global usada por utilitários
      // como `isInstallationModuleOn()` (compatibilidade retroativa)
      setGlobalCapabilitiesModuleVar(caps);
      return caps;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return rejectWithValue(msg);
    }
  },
);

// =================================================================
// SLICE
// =================================================================

const installationCapabilitiesSlice = createSlice({
  name: 'installationCapabilities',
  initialState,
  reducers: {
    /**
     * Define capabilities SEM buscar na API (ex: SSR / tests / setup inicial).
     * Também atualiza a variável global do config/installationCapabilities.
     */
    setCapabilities: (
      state,
      action: PayloadAction<Partial<InstallationCapabilities>>,
    ) => {
      const next = { ...state.capabilities, ...action.payload };
      state.capabilities = next;
      state.isReady = true;
      setGlobalCapabilitiesModuleVar(next);
    },
    /** Reset p/ defaults (ex: logout). */
    resetCapabilities: () => {
      const d = defaultInstallationCapabilities();
      setGlobalCapabilitiesModuleVar(d);
      return {
        capabilities: d,
        isReady: true,
        isLoading: false,
        error: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInstallationCapabilities.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInstallationCapabilities.fulfilled, (state, action) => {
        state.capabilities = action.payload;
        state.isLoading = false;
        state.isReady = true;
        state.error = null;
      })
      .addCase(fetchInstallationCapabilities.rejected, (state, action) => {
        state.isLoading = false;
        state.isReady = true; // pronto mesmo em falha — usamos defaults
        state.error = action.payload ?? 'unknown error';
        // em caso de erro → usar defaults, sem quebrar a UI
        state.capabilities = defaultInstallationCapabilities();
        setGlobalCapabilitiesModuleVar(state.capabilities);
      });
  },
});

// =================================================================
// EXPORTS
// =================================================================

export const { setCapabilities, resetCapabilities } =
  installationCapabilitiesSlice.actions;
export { installationCapabilitiesSlice };
