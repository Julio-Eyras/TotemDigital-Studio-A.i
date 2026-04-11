/**
 * Export Button Component - Smart Signage v2.1
 * Botão para exportar dados em diferentes formatos
 */

import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  FileDownload,
  PictureAsPdf,
  TableChart,
  Description,
  InsertDriveFile,
} from '@mui/icons-material';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';

interface ExportButtonProps {
  type: 'analytics' | 'campaign' | 'totem' | 'client' | 'media' | 'billing' | 'custom';
  filters?: {
    clientId?: number;
    campaignId?: number;
    totemId?: number;
    startDate?: string;
    endDate?: string;
    [key: string]: any;
  };
  title?: string;
  description?: string;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  type,
  filters = {},
  title,
  description,
  variant = 'outlined',
  size = 'medium',
  disabled = false,
}) => {
  const { showSuccess, showError } = useNotification();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      setExporting(format);
      handleClose();

      const endpoint = format === 'excel' 
        ? '/reports/export/excel' 
        : format === 'pdf' 
        ? '/reports/export/pdf' 
        : '/reports/export/csv';
      
      const response = await api.post(
        endpoint,
        {
          type,
          filters,
          title: title || `Export ${type}`,
          description: description || '',
        },
        {
          responseType: format === 'csv' ? 'text' : 'blob', // CSV é texto, outros são binários
        }
      );

      // Criar link de download
      let blob: Blob;
      if (format === 'csv') {
        // CSV vem como texto, converter para blob
        blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      } else {
        blob = new Blob([response.data]);
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Obter nome do arquivo do header ou usar padrão
      const contentDisposition = response.headers['content-disposition'];
      const extensions: Record<string, string> = {
        excel: 'xlsx',
        pdf: 'pdf',
        csv: 'csv'
      };
      let fileName = `export_${type}_${Date.now()}.${extensions[format]}`;
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (fileNameMatch) {
          fileName = fileNameMatch[1];
        }
      }
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showSuccess('Export realizado com sucesso!', `Arquivo ${format.toUpperCase()} baixado.`);
    } catch (error: any) {
      console.error(`Erro ao exportar para ${format}:`, error);
      showError(
        'Erro ao exportar',
        error.response?.data?.message || `Não foi possível exportar para ${format.toUpperCase()}.`
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        startIcon={exporting ? <CircularProgress size={16} /> : <FileDownload />}
        onClick={handleClick}
        disabled={disabled || !!exporting}
      >
        {exporting ? `Exportando ${exporting.toUpperCase()}...` : 'Exportar'}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
          <ListItemIcon>
            {exporting === 'excel' ? (
              <CircularProgress size={16} />
            ) : (
              <TableChart fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>Exportar para Excel</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
          <ListItemIcon>
            {exporting === 'pdf' ? (
              <CircularProgress size={16} />
            ) : (
              <PictureAsPdf fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>Exportar para PDF</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleExport('csv')} disabled={exporting === 'csv'}>
          <ListItemIcon>
            {exporting === 'csv' ? (
              <CircularProgress size={16} />
            ) : (
              <InsertDriveFile fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>Exportar para CSV</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportButton;

