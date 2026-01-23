/**
 * CommandPaletteWrapper Component
 * Wrapper que garante que o CommandPalette só seja renderizado quando o Router estiver pronto
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import CommandPalette, { CommandPaletteProps } from './CommandPalette';

const CommandPaletteWrapper: React.FC<CommandPaletteProps> = (props) => {
  // useLocation garante que estamos dentro do Router
  // Se não estiver, este componente não será renderizado
  const location = useLocation();
  
  // Só renderizar se location estiver disponível (Router pronto)
  if (!location) {
    return null;
  }
  
  return <CommandPalette {...props} />;
};

export default CommandPaletteWrapper;
