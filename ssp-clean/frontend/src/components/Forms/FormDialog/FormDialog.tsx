/**
 * FormDialog Component - SmartSignage Pro v2.1
 * Dialog de formulário reutilizável com tabs, validação e auto-save
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tabs,
  Tab,
  Box,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Close,
  Save,
  Cancel,
} from '@mui/icons-material';

export interface FormTab {
  label: string;
  component: React.ComponentType<any>;
  disabled?: boolean;
}

export interface FormDialogProps<T = any> {
  open: boolean;
  mode: 'create' | 'edit';
  title: string;
  item?: T;
  onClose: () => void;
  onSubmit: (data: T) => Promise<void>;
  tabs?: FormTab[];
  children?: React.ReactNode;
  loading?: boolean;
  autoSave?: boolean;
  confirmClose?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const FormDialog = <T extends Record<string, any>>({
  open,
  mode,
  title,
  item,
  onClose,
  onSubmit,
  tabs,
  children,
  loading = false,
  autoSave = false,
  confirmClose = false,
  maxWidth = 'md',
  fullWidth = true,
}: FormDialogProps<T>) => {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState<T>(item || ({} as T));
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData(item);
      setHasChanges(false);
    } else {
      setFormData({} as T);
    }
    setActiveTab(0);
    setErrors({});
  }, [item, open]);

  const handleClose = () => {
    if (confirmClose && hasChanges) {
      if (window.confirm('Você tem alterações não salvas. Deseja realmente fechar?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await onSubmit(formData);
      setHasChanges(false);
      onClose();
    } catch (error: any) {
      if (error.errors) {
        setErrors(error.errors);
      } else {
        setErrors({ submit: error.message || 'Erro ao salvar' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSave = async () => {
    if (autoSave && hasChanges) {
      try {
        // Auto-save silencioso (não fecha o dialog)
        await onSubmit(formData);
        setHasChanges(false);
      } catch (error) {
        // Ignora erros no auto-save
      }
    }
  };

  useEffect(() => {
    if (autoSave && hasChanges) {
      const timer = setTimeout(handleAutoSave, 2000); // Auto-save após 2s sem mudanças
      return () => clearTimeout(timer);
    }
  }, [formData, autoSave, hasChanges]);

  const updateFormData = (updates: Partial<T>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  // Se há tabs, renderizar com tabs, senão renderizar children diretamente
  const renderContent = () => {
    if (tabs && tabs.length > 0) {
      return (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                disabled={tab.disabled}
              />
            ))}
          </Tabs>

          {tabs.map((tab, index) => {
            const TabComponent = tab.component;
            return (
              <TabPanel key={index} value={activeTab} index={index}>
                <TabComponent
                  data={formData}
                  updateData={updateFormData}
                  errors={errors}
                  mode={mode}
                />
              </TabPanel>
            );
          })}
        </>
      );
    }

    // Se há children, passar props para eles
    if (children) {
      return React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            data: formData,
            updateData: updateFormData,
            errors,
            mode,
          } as any);
        }
        return child;
      });
    }

    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{
        sx: {
          minHeight: tabs && tabs.length > 0 ? 500 : 300,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{title}</span>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ ml: 2 }}
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      {loading && <LinearProgress />}

      <DialogContent>
        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.submit}
          </Alert>
        )}

        {renderContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          startIcon={<Cancel />}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={<Save />}
          disabled={saving || loading}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FormDialog;
