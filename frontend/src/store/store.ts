import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
import { uiSlice } from './slices/uiSlice';
import { notificationSlice } from './slices/notificationSlice';
import { installationCapabilitiesSlice } from './slices/installationCapabilitiesSlice';
import { workbenchSelectionSlice } from './slices/workbenchSelectionSlice';
import { dashboardsSlice } from './slices/dashboardsSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    ui: uiSlice.reducer,
    notification: notificationSlice.reducer,
    installationCapabilities: installationCapabilitiesSlice.reducer,
    workbenchSelection: workbenchSelectionSlice.reducer,
    dashboards: dashboardsSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
