/**
 * Testes unitários - PublisherCard
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PublisherCard from './PublisherCard';
import type { Publisher } from '../../../services/api';

const theme = createTheme();

const mockPublisher: Publisher = {
  publisher_id: 1,
  name: 'Editora Teste',
  contact_name: 'João',
  email: 'joao@teste.com',
  phone: '11999999999',
  client_type: 'publisher',
  active: true,
  is_active: true,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('PublisherCard', () => {
  it('deve renderizar nome do publisher', () => {
    renderWithTheme(<PublisherCard publisher={mockPublisher} />);
    expect(screen.getByText('Editora Teste')).toBeInTheDocument();
  });

  it('deve exibir chip Ativo quando active ou is_active for true', () => {
    renderWithTheme(<PublisherCard publisher={mockPublisher} />);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('deve exibir chip Inativo quando active e is_active forem false', () => {
    const inactive = { ...mockPublisher, active: false, is_active: false };
    renderWithTheme(<PublisherCard publisher={inactive} />);
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });

  it('deve exibir tipo de cliente quando informado', () => {
    renderWithTheme(<PublisherCard publisher={{ ...mockPublisher, client_type: 'publisher' }} />);
    expect(screen.getByText('Organização')).toBeInTheDocument();
  });

  it('deve chamar onView ao clicar em visualizar quando fornecido', () => {
    const onView = jest.fn();
    renderWithTheme(<PublisherCard publisher={mockPublisher} onView={onView} />);
    const buttons = screen.getAllByRole('button');
    const viewButton = buttons[0];
    viewButton.click();
    expect(onView).toHaveBeenCalledWith(mockPublisher);
  });

  it('deve exibir segmento com quantidade de totens entre parênteses', () => {
    renderWithTheme(
      <PublisherCard publisher={{ ...mockPublisher, totems_count: 3, category_segment: 'Totens' }} />
    );
    expect(screen.getByText('Totens (3)')).toBeInTheDocument();
  });

  it('deve exibir só a contagem quando não houver segmento', () => {
    renderWithTheme(
      <PublisherCard publisher={{ ...mockPublisher, totems_count: 1 }} />
    );
    expect(screen.getByText('1 totem')).toBeInTheDocument();
  });
});
