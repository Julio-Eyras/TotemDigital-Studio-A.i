/**
 * workbenchSelectionSlice — 5º slice Redux (Sprint 2)
 *
 * Centraliza o estado de SELEÇÃO usado em 9+ páginas do workbench:
 *  - QuickPublish / Programação
 *  - Totens (lista, detalhe)
 *  - Anunciantes / Contratos
 *  - Campanhas
 *  - Mídias
 *  - Analytics
 *  - Monitor (Dispatcher)
 *
 * ANTES: 20+ useState() locais por página → cada uma reiniciava ao navegar.
 * AGORA: 1 slice global → navegar entre páginas preserva a seleção do usuário.
 */

import { createSlice, PayloadAction, Draft } from '@reduxjs/toolkit';

// =================================================================
// TYPES (também exportados para uso em componentes)
// =================================================================

export interface DashboardDateRange {
  startDate: string; // ISO date (yyyy-mm-dd)
  endDate: string;   // ISO date (yyyy-mm-dd)
  presetLabel?: string; // ex: 'Últimos 7 dias', 'Últimos 30 dias'
}

export interface TotemFilter {
  search?: string;
  status?: 'online' | 'offline' | 'error' | string;
  localId?: number | null;
  publisherId?: number | null;
  groupId?: number | null;
  tag?: string;
  platform?: string;
}

export interface MediaFilter {
  search?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'html' | string;
  status?: 'approved' | 'pending_approval' | 'rejected' | 'draft' | string;
  subscriberId?: number | null;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
}

export interface CampaignFilter {
  search?: string;
  status?: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | string;
  subscriberId?: number | null;
  contractId?: number | null;
  scopeTotemId?: number | null;
  scopeGroupId?: number | null;
}

export interface SubscriberFilter {
  search?: string;
  hasBillingOverdue?: boolean | null;
  hasBillingPublishBlocked?: boolean | null;
  isActive?: boolean | null;
}

// =================================================================
// STATE
// =================================================================

export interface WorkbenchSelectionState {
  // ===== IDs selecionados =====
  selectedTotemIds: number[];
  selectedMediaIds: number[];
  selectedCampaignIds: number[];
  selectedSubscriberId: number | null;
  selectedContractId: number | null;

  // ===== Filtros (preservados entre navegações) =====
  filters: {
    dateRange: DashboardDateRange;
    totem: TotemFilter;
    media: MediaFilter;
    campaign: CampaignFilter;
    subscriber: SubscriberFilter;
  };

  // ===== Último estado usado (última aba / página) =====
  lastWorkbenchPage: string; // ex: '/totens', '/midias', '/campanhas'
  lastTotemDetailId: number | null;
  lastSubscriberDetailId: number | null;

  // ===== Flags de UI =====
  hasDraftPublishing: boolean;   // QuickPublish
  hasDraftCampaign: boolean;     // Campanha
  quickPublishViewMode: 'table' | 'kanban' | 'calendar';
  monitorViewMode: 'grid' | 'list' | 'timeline';
}

const today = new Date();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const initialState: WorkbenchSelectionState = {
  selectedTotemIds: [],
  selectedMediaIds: [],
  selectedCampaignIds: [],
  selectedSubscriberId: null,
  selectedContractId: null,

  filters: {
    dateRange: {
      startDate: isoDate(sevenDaysAgo),
      endDate: isoDate(today),
      presetLabel: 'Últimos 7 dias',
    },
    totem: {},
    media: {},
    campaign: {},
    subscriber: {},
  },

  lastWorkbenchPage: '/totens',
  lastTotemDetailId: null,
  lastSubscriberDetailId: null,

  hasDraftPublishing: false,
  hasDraftCampaign: false,
  quickPublishViewMode: 'table',
  monitorViewMode: 'grid',
};

// =================================================================
// SLICE
// =================================================================

type WritableDraft<T> = Draft<T>;

const workbenchSelectionSlice = createSlice({
  name: 'workbenchSelection',
  initialState,
  reducers: {
    // ======== Totem ========
    selectTotem: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      if (!state.selectedTotemIds.includes(id)) {
        state.selectedTotemIds.push(id);
      }
    },
    toggleTotem: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      const idx = state.selectedTotemIds.indexOf(id);
      if (idx >= 0) state.selectedTotemIds.splice(idx, 1);
      else state.selectedTotemIds.push(id);
    },
    deselectTotem: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      state.selectedTotemIds = state.selectedTotemIds.filter((t) => t !== id);
    },
    setSelectedTotemIds: (state, action: PayloadAction<number[]>) => {
      state.selectedTotemIds = action.payload;
    },
    clearSelectedTotemIds: (state) => {
      state.selectedTotemIds = [];
    },

    // ======== Mídia ========
    toggleMedia: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      const idx = state.selectedMediaIds.indexOf(id);
      if (idx >= 0) state.selectedMediaIds.splice(idx, 1);
      else state.selectedMediaIds.push(id);
    },
    setSelectedMediaIds: (state, action: PayloadAction<number[]>) => {
      state.selectedMediaIds = action.payload;
    },
    clearSelectedMediaIds: (state) => {
      state.selectedMediaIds = [];
    },

    // ======== Campanha ========
    toggleCampaign: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      const idx = state.selectedCampaignIds.indexOf(id);
      if (idx >= 0) state.selectedCampaignIds.splice(idx, 1);
      else state.selectedCampaignIds.push(id);
    },
    setSelectedCampaignIds: (state, action: PayloadAction<number[]>) => {
      state.selectedCampaignIds = action.payload;
    },
    clearSelectedCampaignIds: (state) => {
      state.selectedCampaignIds = [];
    },

    // ======== Subscriber ========
    setSelectedSubscriberId: (state, action: PayloadAction<number | null>) => {
      state.selectedSubscriberId = action.payload;
      if (action.payload == null) {
        state.selectedContractId = null; // reset contrato depende
      }
      state.lastSubscriberDetailId = action.payload ?? state.lastSubscriberDetailId;
    },

    // ======== Contract ========
    setSelectedContractId: (state, action: PayloadAction<number | null>) => {
      state.selectedContractId = action.payload;
    },

    // ======== Filtros ========
    setDateRange: (state, action: PayloadAction<Partial<DashboardDateRange>>) => {
      const { startDate, endDate, presetLabel } = action.payload;
      const next: DashboardDateRange = { ...state.filters.dateRange };
      if (startDate) next.startDate = startDate;
      if (endDate) next.endDate = endDate;
      if (presetLabel !== undefined) next.presetLabel = presetLabel;
      state.filters.dateRange = next;
    },
    setTotemFilter: (state, action: PayloadAction<TotemFilter>) => {
      state.filters.totem = { ...state.filters.totem, ...action.payload };
    },
    setMediaFilter: (state, action: PayloadAction<MediaFilter>) => {
      state.filters.media = { ...state.filters.media, ...action.payload };
    },
    setCampaignFilter: (state, action: PayloadAction<CampaignFilter>) => {
      state.filters.campaign = { ...state.filters.campaign, ...action.payload };
    },
    setSubscriberFilter: (state, action: PayloadAction<SubscriberFilter>) => {
      state.filters.subscriber = { ...state.filters.subscriber, ...action.payload };
    },
    resetAllFilters: (state) => {
      state.filters.totem = {};
      state.filters.media = {};
      state.filters.campaign = {};
      state.filters.subscriber = {};
    },

    // ======== Última página ========
    setLastWorkbenchPage: (state, action: PayloadAction<string>) => {
      state.lastWorkbenchPage = action.payload;
    },
    setLastTotemDetailId: (state, action: PayloadAction<number | null>) => {
      state.lastTotemDetailId = action.payload;
    },

    // ======== UI ========
    setQuickPublishViewMode: (
      state,
      action: PayloadAction<WorkbenchSelectionState['quickPublishViewMode']>,
    ) => {
      state.quickPublishViewMode = action.payload;
    },
    setMonitorViewMode: (
      state,
      action: PayloadAction<WorkbenchSelectionState['monitorViewMode']>,
    ) => {
      state.monitorViewMode = action.payload;
    },
    setHasDraftPublishing: (state, action: PayloadAction<boolean>) => {
      state.hasDraftPublishing = action.payload;
    },
    setHasDraftCampaign: (state, action: PayloadAction<boolean>) => {
      state.hasDraftCampaign = action.payload;
    },

    // ======== Hard reset ========
    resetWorkbenchSelection: () => initialState,
  },
});

// =================================================================
// EXPORTS
// =================================================================

export const {
  selectTotem,
  toggleTotem,
  deselectTotem,
  setSelectedTotemIds,
  clearSelectedTotemIds,
  toggleMedia,
  setSelectedMediaIds,
  clearSelectedMediaIds,
  toggleCampaign,
  setSelectedCampaignIds,
  clearSelectedCampaignIds,
  setSelectedSubscriberId,
  setSelectedContractId,
  setDateRange,
  setTotemFilter,
  setMediaFilter,
  setCampaignFilter,
  setSubscriberFilter,
  resetAllFilters,
  setLastWorkbenchPage,
  setLastTotemDetailId,
  setQuickPublishViewMode,
  setMonitorViewMode,
  setHasDraftPublishing,
  setHasDraftCampaign,
  resetWorkbenchSelection,
} = workbenchSelectionSlice.actions;

export { workbenchSelectionSlice };
