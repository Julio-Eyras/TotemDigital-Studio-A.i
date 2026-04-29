import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  darkTone: 'carvao' | 'grafite' | 'suave';
  language: 'pt' | 'en';
  loading: boolean;
  pageTitle: string;
  breadcrumbs: Array<{
    label: string;
    path?: string;
  }>;
}

const initialState: UIState = {
  sidebarOpen: true,
  theme: 'light',
  darkTone: 'carvao',
  language: 'pt',
  loading: false,
  pageTitle: 'Smart Signage v2.0',
  breadcrumbs: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    setDarkTone: (state, action: PayloadAction<'carvao' | 'grafite' | 'suave'>) => {
      state.darkTone = action.payload;
    },
    setLanguage: (state, action: PayloadAction<'pt' | 'en'>) => {
      state.language = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setPageTitle: (state, action: PayloadAction<string>) => {
      state.pageTitle = action.payload;
    },
    setBreadcrumbs: (state, action: PayloadAction<Array<{ label: string; path?: string }>>) => {
      state.breadcrumbs = action.payload;
    },
    addBreadcrumb: (state, action: PayloadAction<{ label: string; path?: string }>) => {
      state.breadcrumbs.push(action.payload);
    },
    clearBreadcrumbs: (state) => {
      state.breadcrumbs = [];
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  setDarkTone,
  setLanguage,
  setLoading,
  setPageTitle,
  setBreadcrumbs,
  addBreadcrumb,
  clearBreadcrumbs,
} = uiSlice.actions;

export { uiSlice };
