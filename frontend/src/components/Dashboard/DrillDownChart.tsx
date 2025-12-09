/**
 * DrillDownChart Component - Smart Signage Pro v3.1
 * Componente de gráfico com funcionalidade de drill-down
 */

import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Breadcrumbs, Link } from '@mui/material';
import { NavigateNext, ArrowBack } from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface DrillDownData {
  level: 'overview' | 'category' | 'detail';
  title: string;
  data: Array<Record<string, unknown>>;
  chartType: 'line' | 'bar';
  onItemClick?: (item: Record<string, unknown>) => void;
}

interface DrillDownChartProps {
  initialData: DrillDownData;
  onBack?: () => void;
}

export const DrillDownChart: React.FC<DrillDownChartProps> = ({ initialData, onBack }) => {
  const [drillDownStack, setDrillDownStack] = useState<DrillDownData[]>([initialData]);
  const currentData = drillDownStack[drillDownStack.length - 1];

  const handleItemClick = (item: Record<string, unknown>) => {
    if (currentData.onItemClick) {
      currentData.onItemClick(item);
    }
  };

  const handleBack = () => {
    if (drillDownStack.length > 1) {
      setDrillDownStack(prev => prev.slice(0, -1));
    } else if (onBack) {
      onBack();
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setDrillDownStack(prev => prev.slice(0, index + 1));
  };

  const renderChart = () => {
    if (currentData.chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={currentData.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={currentData.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" onClick={handleItemClick} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
          {drillDownStack.map((data, index) => (
            <Link
              key={index}
              component="button"
              variant="body1"
              onClick={() => handleBreadcrumbClick(index)}
              sx={{ cursor: 'pointer' }}
            >
              {data.title}
            </Link>
          ))}
        </Breadcrumbs>
        {drillDownStack.length > 1 && (
          <Button
            startIcon={<ArrowBack />}
            onClick={handleBack}
            variant="outlined"
            size="small"
          >
            Voltar
          </Button>
        )}
      </Box>

      {/* Título */}
      <Typography variant="h6" gutterBottom>
        {currentData.title}
      </Typography>

      {/* Gráfico */}
      {renderChart()}
    </Paper>
  );
};

export default DrillDownChart;

