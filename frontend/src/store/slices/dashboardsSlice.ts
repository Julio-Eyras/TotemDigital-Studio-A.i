import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  dashboardsApi,
  AceDashboardResponse,
  FxDashboardResponse,
  GeneralAnalyticsResponse,
  DashboardFilters,
  AnyDashboardResponse,
  DashboardAggregateRequest
} from '../../services/api/dashboardsApi';

export type DashboardKind = 'ace' | 'fx' | 'general';

export interface DashboardsLoading {
  ace: boolean;
  fx: boolean;
  general: boolean;
  aggregate: boolean;
}

export interface DashboardsError {
  ace: string | null;
  fx: string | null;
  general: string | null;
  aggregate: string | null;
}

export interface DashboardsState {
  ace: AceDashboardResponse | null;
  fx: FxDashboardResponse | null;
  general: GeneralAnalyticsResponse | null;
  lastKind: DashboardKind | null;
  loading: DashboardsLoading;
  error: DashboardsError;
  activeFilters: DashboardFilters;
  useCache: boolean;
  ttlSec: number;
}

const initialState: DashboardsState = {
  ace: null,
  fx: null,
  general: null,
  lastKind: null,
  loading: { ace: false, fx: false, general: false, aggregate: false },
  error: { ace: null, fx: null, general: null, aggregate: null },
  activeFilters: { granularity: 'day' },
  useCache: true,
  ttlSec: 300
};

interface FetchArgs {
  filters?: DashboardFilters;
  useCache?: boolean;
  ttlSec?: number;
}

export const fetchAceDashboard = createAsyncThunk<AceDashboardResponse, FetchArgs | undefined>(
  'dashboards/fetchAce',
  async (args, { rejectWithValue }) => {
    try {
      return await dashboardsApi.getAce(args);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha desconhecida ao carregar dashboard ACE';
      return rejectWithValue(msg);
    }
  }
);

export const fetchFxDashboard = createAsyncThunk<FxDashboardResponse, FetchArgs | undefined>(
  'dashboards/fetchFx',
  async (args, { rejectWithValue }) => {
    try {
      return await dashboardsApi.getFx(args);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha desconhecida ao carregar dashboard FX';
      return rejectWithValue(msg);
    }
  }
);

export const fetchGeneralDashboard = createAsyncThunk<GeneralAnalyticsResponse, FetchArgs | undefined>(
  'dashboards/fetchGeneral',
  async (args, { rejectWithValue }) => {
    try {
      return await dashboardsApi.getGeneral(args);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha desconhecida ao carregar dashboard Geral';
      return rejectWithValue(msg);
    }
  }
);

export const aggregateDashboard = createAsyncThunk<AnyDashboardResponse, DashboardAggregateRequest>(
  'dashboards/aggregate',
  async (body, { rejectWithValue }) => {
    try {
      return await dashboardsApi.aggregate(body);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha desconhecida ao agregar dashboards';
      return rejectWithValue(msg);
    }
  }
);

export const dashboardsSlice = createSlice({
  name: 'dashboards',
  initialState,
  reducers: {
    setActiveFilters(state, action: PayloadAction<DashboardFilters>) {
      state.activeFilters = { ...state.activeFilters, ...action.payload };
    },
    resetFilters(state) {
      state.activeFilters = { granularity: 'day' };
    },
    setCachePolicy(state, action: PayloadAction<{ useCache: boolean; ttlSec?: number }>) {
      state.useCache = action.payload.useCache;
      if (typeof action.payload.ttlSec === 'number') state.ttlSec = action.payload.ttlSec;
    },
    clearKind(state, action: PayloadAction<DashboardKind | 'all'>) {
      if (action.payload === 'all') {
        state.ace = null;
        state.fx = null;
        state.general = null;
      } else {
        state[action.payload] = null;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAceDashboard.pending, (s) => {
        s.loading.ace = true;
        s.error.ace = null;
      })
      .addCase(fetchAceDashboard.fulfilled, (s, action) => {
        s.loading.ace = false;
        s.ace = action.payload;
        s.lastKind = 'ace';
      })
      .addCase(fetchAceDashboard.rejected, (s, action) => {
        s.loading.ace = false;
        s.error.ace = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(fetchFxDashboard.pending, (s) => {
        s.loading.fx = true;
        s.error.fx = null;
      })
      .addCase(fetchFxDashboard.fulfilled, (s, action) => {
        s.loading.fx = false;
        s.fx = action.payload;
        s.lastKind = 'fx';
      })
      .addCase(fetchFxDashboard.rejected, (s, action) => {
        s.loading.fx = false;
        s.error.fx = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(fetchGeneralDashboard.pending, (s) => {
        s.loading.general = true;
        s.error.general = null;
      })
      .addCase(fetchGeneralDashboard.fulfilled, (s, action) => {
        s.loading.general = false;
        s.general = action.payload;
        s.lastKind = 'general';
      })
      .addCase(fetchGeneralDashboard.rejected, (s, action) => {
        s.loading.general = false;
        s.error.general = (action.payload as string) ?? action.error.message ?? null;
      });

    builder
      .addCase(aggregateDashboard.pending, (s) => {
        s.loading.aggregate = true;
        s.error.aggregate = null;
      })
      .addCase(aggregateDashboard.fulfilled, (s, action) => {
        s.loading.aggregate = false;
        s.lastKind = action.meta.arg.kind;
        const kind = action.meta.arg.kind;
        if (kind === 'ace') s.ace = action.payload as AceDashboardResponse;
        else if (kind === 'fx') s.fx = action.payload as FxDashboardResponse;
        else s.general = action.payload as GeneralAnalyticsResponse;
      })
      .addCase(aggregateDashboard.rejected, (s, action) => {
        s.loading.aggregate = false;
        s.error.aggregate = (action.payload as string) ?? action.error.message ?? null;
      });
  }
});

export const { setActiveFilters, resetFilters, setCachePolicy, clearKind } = dashboardsSlice.actions;
export default dashboardsSlice.reducer;
