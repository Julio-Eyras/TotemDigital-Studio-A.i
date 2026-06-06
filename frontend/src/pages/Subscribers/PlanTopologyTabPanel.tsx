import React from 'react';
import {
  Alert,
  Box,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { Computer, Tv } from '@mui/icons-material';
import { Local } from '../../services/api';
import { getTotemIdFromRow, getTotemLocalIdFromRow } from '../../utils/totemRowIds';
import type { PlanTopologyPreviewRow } from './planTopologyPreview';
import { getProductTerminology } from '../../config/productTerminology';
import { countTopologyInRows } from './planTopologyPreview';

export type PlanTopologyUiVariant = 'create' | 'edit' | 'details';

export interface PlanTopologyTabPanelProps {
  mode: 'locals' | 'totens' | 'smartTvs';
  preview: { loading: boolean; error: string | null; rows: PlanTopologyPreviewRow[] };
  variant: PlanTopologyUiVariant;
  contractCount: number;
  /** Sem título H6 no topo (quando já há tabs ou cabeçalho do contrato). */
  dense?: boolean;
}

function resolveTotemLocalCaption(totem: any, locals: Local[]): string {
  const lid = getTotemLocalIdFromRow(totem);
  if (lid == null) return '—';
  const loc = locals.find((l) => Number(l.local_id) === Number(lid));
  return loc?.name || `Local #${lid}`;
}

function resolveSmartTvTotemCaption(tv: any, totems: any[]): string {
  const tid = tv.totem_id ?? tv.totemId;
  if (tid == null) return '—';
  const t = totems.find((x) => Number(getTotemIdFromRow(x)) === Number(tid));
  return t?.name || t?.identifier || `Totem #${tid}`;
}

const variantAlertTail: Record<PlanTopologyUiVariant, string> = {
  create: 'neste assistente',
  edit: 'neste painel',
  details: 'neste painel',
};

/** Cabeçalhos de tabela / seções: azul escuro e tamanho destacado (leitura rápida). */
const tableHeaderCellSx = {
  color: 'primary.dark',
  fontWeight: 700,
  fontSize: '0.9375rem',
  lineHeight: 1.3,
  borderBottomColor: 'divider',
} as const;

const sectionHeadingSx = {
  color: 'primary.dark',
  fontWeight: 700,
  fontSize: '0.9375rem',
  lineHeight: 1.35,
} as const;

export const PlanTopologyTabPanel: React.FC<PlanTopologyTabPanelProps> = ({
  mode,
  preview,
  variant,
  contractCount,
  dense,
}) => {
  const orgTerms = getProductTerminology();
  const theme = useTheme();
  const { lc, tt, st } = countTopologyInRows(preview.rows);

  const noPlanCopy =
    variant === 'create'
      ? 'Sem plano neste contrato — defina um plano na aba Contratos para ver a rede.'
      : 'Sem plano neste contrato — associe um plano ao contrato para ver a rede.';

  return (
    <Box>
      {!dense && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {mode === 'locals' && 'Locais da rede do plano'}
          {mode === 'totens' && 'Totens da rede do plano'}
          {mode === 'smartTvs' && 'Smart TVs na rede do plano'}
        </Typography>
      )}
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Somente visualização.</strong> O contrato associa um <strong>plano</strong>; os locais e totens em que o
        anunciante pode veicular campanhas são os definidos por esse plano ({orgTerms.organizationPlural.toLowerCase()} autorizadas e respectivos
        locais/totens). Não é permitido alterar essa rede {variantAlertTail[variant]}.
      </Alert>
      {preview.loading && <LinearProgress sx={{ mb: 2 }} />}
      {preview.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {preview.error}
        </Alert>
      )}
      {!preview.loading && contractCount === 0 && (
        <Alert severity="warning">
          {variant === 'create' ? (
            <>
              Adicione pelo menos um contrato na aba <strong>Contratos</strong>.
            </>
          ) : (
            <>Nenhum contrato vinculado a este anunciante.</>
          )}
        </Alert>
      )}
      {!preview.loading &&
        contractCount > 0 &&
        preview.rows.length > 0 &&
        preview.rows.every((r) => !r.planId) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Associe um <strong>plano</strong> a cada contrato para visualizar locais, totens e TVs correspondentes.
          </Alert>
        )}
      {!preview.loading &&
        preview.rows.map((row) => {
          const inner = (
            <>
              {!dense || variant !== 'details' ? (
                <Typography variant="h6" component="div" sx={{ color: 'primary.dark', fontWeight: 700, fontSize: '1.05rem', mb: 0.25 }}>
                  {row.title}
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {row.planId ? (
                  <>
                    Plano: {row.planName} (ID {row.planId})
                  </>
                ) : (
                  <>{noPlanCopy}</>
                )}
              </Typography>
              {row.planId && row.publishers.length === 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Nenhuma {orgTerms.organization.toLowerCase()} permitida para este plano em <strong>Planos e {orgTerms.organizationPlural.toLowerCase()}</strong>, ou todas
                  estão bloqueadas.
                </Alert>
              )}
              {row.planId &&
                row.publishers.map((pub) => (
                  <Box key={pub.publisher_id} sx={{ mb: 2, pl: 1, borderLeft: `3px solid ${theme.palette.divider}` }}>
                    <Typography variant="subtitle1" component="div" sx={sectionHeadingSx}>
                      {pub.publisher_name}
                    </Typography>
                    {mode === 'locals' &&
                      (pub.locals.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Nenhum local nesta {orgTerms.organization.toLowerCase()}.
                        </Typography>
                      ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={tableHeaderCellSx}>Local</TableCell>
                                <TableCell sx={tableHeaderCellSx}>Endereço</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {pub.locals.map((loc) => (
                                <TableRow key={loc.local_id}>
                                  <TableCell>{loc.name}</TableCell>
                                  <TableCell>
                                    {[loc.address, loc.city, loc.state].filter(Boolean).join(', ') || '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ))}
                    {mode === 'totens' &&
                      (pub.totems.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Nenhum totem nesta {orgTerms.organization.toLowerCase()}.
                        </Typography>
                      ) : (
                        <List dense sx={{ mt: 1 }}>
                          {pub.totems.map((totem: any, idx: number) => (
                            <ListItem key={String(getTotemIdFromRow(totem) ?? idx)} sx={{ py: 0.5 }}>
                              <ListItemIcon>
                                <Computer fontSize="small" />
                              </ListItemIcon>
                              <ListItemText
                                primary={totem.name || totem.identifier || 'Totem'}
                                secondary={`Local: ${resolveTotemLocalCaption(totem, pub.locals)} · ${
                                  totem.identifier || '—'
                                }`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      ))}
                    {mode === 'smartTvs' &&
                      (pub.smartTvs.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          Nenhuma Smart TV adicional registada nesta {orgTerms.organization.toLowerCase()}.
                        </Typography>
                      ) : (
                        <List dense sx={{ mt: 1 }}>
                          {pub.smartTvs.map((tv: any, idx: number) => (
                            <ListItem key={String(tv.smart_tv_id ?? tv.smartTvId ?? tv.id ?? idx)} sx={{ py: 0.5 }}>
                              <ListItemIcon>
                                <Tv fontSize="small" />
                              </ListItemIcon>
                              <ListItemText
                                primary={tv.name || tv.identifier || 'Smart TV'}
                                secondary={`Totem: ${resolveSmartTvTotemCaption(tv, pub.totems)}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      ))}
                  </Box>
                ))}
            </>
          );

          return dense ? (
            <Box key={row.rowKey} sx={{ pt: 0.5 }}>
              {inner}
            </Box>
          ) : (
            <Paper key={row.rowKey} variant="outlined" sx={{ p: 2, mb: 2 }}>
              {inner}
            </Paper>
          );
        })}
      {!preview.loading &&
        contractCount > 0 &&
        preview.rows.some((r) => r.planId) &&
        lc === 0 &&
        tt === 0 &&
        st === 0 && (
          <Alert severity="info">
            O plano não devolveu locais ou totens para as {orgTerms.organizationPlural.toLowerCase()} permitidas. Confira cadastros de locais/totens e o
            mapeamento plano ↔ {orgTerms.organization.toLowerCase()}.
          </Alert>
        )}
    </Box>
  );
};
