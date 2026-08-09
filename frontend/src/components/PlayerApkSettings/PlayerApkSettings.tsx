import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import {
  Android,
  Download,
  MenuBook,
  OpenInNew,
  Refresh,
  SystemUpdateAlt,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import {
  PlayerApkDocument,
  PlayerApkRelease,
  playerApkApi,
} from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

interface Props {
  canManageOta: boolean;
  canDownloadApk: boolean;
}

function bytesLabel(value: number): string {
  if (!value) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function dateLabel(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const PlayerApkSettings: React.FC<Props> = ({ canManageOta, canDownloadApk }) => {
  const [release, setRelease] = useState<PlayerApkRelease | null>(null);
  const [documents, setDocuments] = useState<PlayerApkDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [nextRelease, nextDocuments] = await Promise.all([
        canDownloadApk ? playerApkApi.getDesignated() : Promise.resolve(null),
        playerApkApi.getDocuments(),
      ]);
      setRelease(nextRelease);
      setDocuments(nextDocuments);
    } catch (requestError) {
      setError(pickApiErrorMessage(requestError, 'Não foi possível carregar a central APK'));
    } finally {
      setLoading(false);
    }
  }, [canDownloadApk]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadApk = async () => {
    if (!release) return;
    try {
      setBusy('apk');
      setError(null);
      const blob = await playerApkApi.downloadDesignated();
      saveBlob(blob, release.originalFilename || `Player-AD-${release.version}.apk`);
    } catch (requestError) {
      setError(pickApiErrorMessage(requestError, 'Não foi possível baixar o APK'));
    } finally {
      setBusy(null);
    }
  };

  const openDocument = async (document: PlayerApkDocument) => {
    const target = window.open('', '_blank');
    if (target) target.opener = null;
    try {
      setBusy(document.slug);
      setError(null);
      const blob = await playerApkApi.getDocument(document.slug);
      const url = URL.createObjectURL(blob);
      if (target) target.location.href = url;
      else saveBlob(blob, `${document.slug}.md`);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      target?.close();
      setError(pickApiErrorMessage(requestError, 'Não foi possível abrir o documento'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Player-AD APK</Typography>
          <Typography variant="body2" color="text.secondary">
            Versão oficial de produção, download autenticado e documentação operacional.
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={() => void load()}>Atualizar</Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {!canDownloadApk ? (
        <Alert severity="info">
          O download do APK é restrito à administração e à operação técnica.
        </Alert>
      ) : release ? (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Android color="success" />
              <Typography variant="h6" fontWeight={700}>
                Player-AD {release.version}
                {release.versionCode ? ` · build ${release.versionCode}` : ''}
              </Typography>
              <Chip size="small" color="success" label="Oficial · produção" />
            </Stack>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2"><strong>Package:</strong> {release.packageName || 'br.com.smartchannel.playerad'}</Typography>
                <Typography variant="body2"><strong>Tamanho:</strong> {bytesLabel(release.fileSize)}</Typography>
                <Typography variant="body2"><strong>Designada em:</strong> {dateLabel(release.designatedAt)}</Typography>
                <Typography variant="body2"><strong>Commit:</strong> {release.sourceCommit || 'não informado'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  <strong>SHA-256:</strong> {release.checksum}
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  <strong>Certificado:</strong> {release.signingCertSha256 || 'não informado'}
                </Typography>
              </Grid>
            </Grid>
            {release.description && (
              <Typography variant="body2" sx={{ mt: 2 }}>{release.description}</Typography>
            )}
          </CardContent>
          <CardActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={busy === 'apk' ? <CircularProgress size={16} color="inherit" /> : <Download />}
              disabled={busy === 'apk'}
              onClick={() => void downloadApk()}
            >
              Baixar APK oficial
            </Button>
            {canManageOta && (
              <Button component={RouterLink} to="/ota-updates" startIcon={<SystemUpdateAlt />}>
                Gerenciar versões OTA
              </Button>
            )}
          </CardActions>
        </Card>
      ) : (
        <Alert severity="warning">
          Nenhum APK Android foi designado para produção.
          {canManageOta ? ' Ative uma versão no gerenciamento OTA para torná-la oficial.' : ''}
        </Alert>
      )}

      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>Documentação</Typography>
        <Grid container spacing={2}>
          {documents.map((document) => (
            <Grid item xs={12} sm={6} md={4} key={document.slug}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <MenuBook color="primary" />
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>
                    {document.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {document.summary}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    endIcon={
                      busy === document.slug
                        ? <CircularProgress size={14} />
                        : <OpenInNew />
                    }
                    disabled={busy === document.slug}
                    onClick={() => void openDocument(document)}
                  >
                    Abrir
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
};

export default PlayerApkSettings;
