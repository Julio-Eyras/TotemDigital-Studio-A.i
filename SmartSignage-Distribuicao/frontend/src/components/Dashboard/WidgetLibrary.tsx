/**
 * Widget Library - Smart Signage Pro v3.1
 * Biblioteca de widgets disponíveis para dashboards customizáveis
 */

import React from 'react';
import { Box, Grid, Typography, Card, CardContent } from '@mui/material';
import { BarChart, TableChart, Assessment, List } from '@mui/icons-material';

export interface WidgetTemplate {
  id: string;
  name: string;
  type: 'chart' | 'table' | 'kpi' | 'list';
  icon: React.ReactNode;
  description: string;
  defaultConfig: Record<string, any>;
}

const widgetTemplates: WidgetTemplate[] = [
  {
    id: 'kpi-total-clients',
    name: 'Total de Clientes',
    type: 'kpi',
    icon: <Assessment />,
    description: 'Exibe o total de clientes ativos',
    defaultConfig: { metric: 'totalClients' }
  },
  {
    id: 'kpi-total-totems',
    name: 'Total de Totens',
    type: 'kpi',
    icon: <Assessment />,
    description: 'Exibe o total de totens',
    defaultConfig: { metric: 'totalTotems' }
  },
  {
    id: 'chart-line',
    name: 'Gráfico de Linha',
    type: 'chart',
    icon: <BarChart />,
    description: 'Gráfico de linha para tendências',
    defaultConfig: { chartType: 'line' }
  },
  {
    id: 'chart-bar',
    name: 'Gráfico de Barras',
    type: 'chart',
    icon: <BarChart />,
    description: 'Gráfico de barras para comparações',
    defaultConfig: { chartType: 'bar' }
  },
  {
    id: 'table-data',
    name: 'Tabela de Dados',
    type: 'table',
    icon: <TableChart />,
    description: 'Tabela para exibir dados tabulares',
    defaultConfig: { columns: [] }
  },
  {
    id: 'list-activities',
    name: 'Lista de Atividades',
    type: 'list',
    icon: <List />,
    description: 'Lista de atividades recentes',
    defaultConfig: { limit: 10 }
  }
];

interface WidgetLibraryProps {
  onSelectWidget: (template: WidgetTemplate) => void;
}

export const WidgetLibrary: React.FC<WidgetLibraryProps> = ({ onSelectWidget }) => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Biblioteca de Widgets
      </Typography>
      <Grid container spacing={2}>
        {widgetTemplates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 4
                }
              }}
              onClick={() => onSelectWidget(template)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {template.icon}
                  <Typography variant="subtitle1">{template.name}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {template.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default WidgetLibrary;

