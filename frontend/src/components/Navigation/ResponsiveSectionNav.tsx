import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';

export interface ResponsiveSection {
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}

interface ResponsiveSectionNavProps {
  sections: readonly ResponsiveSection[];
  value: number;
  onChange: (nextValue: number) => void;
  isMobileNav: boolean;
  idPrefix: string;
  mobileButtonLabel?: string;
}

export default function ResponsiveSectionNav({
  sections,
  value,
  onChange,
  isMobileNav,
  idPrefix,
  mobileButtonLabel = 'Seções',
}: ResponsiveSectionNavProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNav) setMobileDrawerOpen(false);
  }, [isMobileNav]);

  const selectSection = (index: number) => {
    onChange(index);
    setMobileDrawerOpen(false);
  };

  const drawerId = `${idPrefix}-mobile-drawer`;

  return (
    <>
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          id: drawerId,
          sx: { width: 280, maxWidth: '88vw', boxSizing: 'border-box' },
        }}
      >
        <Box sx={{ pt: 2, pb: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 2, pb: 1, color: 'text.secondary' }}>
            Seções
          </Typography>
          <List disablePadding aria-label={`Lista de seções (${idPrefix})`}>
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <ListItem key={section.label} disablePadding>
                  <ListItemButton
                    selected={value === index}
                    onClick={() => selectSection(index)}
                    disabled={section.disabled}
                    sx={{ py: 1.25 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={section.label}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {isMobileNav ? (
        <Box
          role="navigation"
          aria-label={`Seção atual (${idPrefix})`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1.25,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Button
            variant="outlined"
            size="small"
            startIcon={<MenuIcon />}
            onClick={() => setMobileDrawerOpen(true)}
            aria-expanded={mobileDrawerOpen}
            aria-controls={drawerId}
          >
            {mobileButtonLabel}
          </Button>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            noWrap
            sx={{ flex: 1, textAlign: 'right', minWidth: 0 }}
          >
            {sections[value]?.label ?? ''}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={value}
            onChange={(_event, next) => onChange(next)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label={`Seções (${idPrefix})`}
          >
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <Tab
                  key={section.label}
                  icon={<Icon />}
                  label={section.label}
                  iconPosition="start"
                  disabled={section.disabled}
                  id={`${idPrefix}-tab-${index}`}
                  aria-controls={`${idPrefix}-tabpanel-${index}`}
                />
              );
            })}
          </Tabs>
        </Box>
      )}
    </>
  );
}
