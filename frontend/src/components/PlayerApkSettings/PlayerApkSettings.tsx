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
  TextField,
  Typography,
} from '@mui/material';
import {
  Android,
  Download,
  MenuBook,
  OpenInNew,
  Refresh,
  SystemUpdateAlt,
  Upload,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import {
  PlayerApkCandidate,
  PlayerApkDocument,
  PlayerApkInstaller,
  PlayerApkRelease,
  playerApkApi,
} from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

interface Props {
  canManageOta: boolean;
  canDownloadApk: boolean;
  canDesignateApk: boolean;
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

const PlayerApkSettings: React.FC<Props> = ({
  canManageOta,
  canDownloadApk,
  canDesignateApk,
}) => {
  const [release, setRelease] = useState<PlayerApkRelease | null>(null);
  const [installer, setInstaller] = useState<PlayerApkInstaller | null>(null);
  const [candidates, setCandidates] = useState<PlayerApkCandidate[]>([]);
  const [documents, setDocuments] = useState<PlayerApkDocument[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState('2.12');
  const [versionCode, setVersionCode] = useState('112');
  const [apkFile, setApkFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docsPromise = playerApkApi.getDocuments().catch(() => [] as PlayerApkDocument[]);
      const designatedPromise = canDownloadApk
        ? playerApkApi.getDesignated()
        : Promise.resolve({ release: null, schemaReady: true, installer: null });
      const candidatesPromise = canDesignateApk
        ? playerApkApi.listCandidates().catch(() => ({ candidates: [], schemaReady: true }))
        : Promise.resolve({ candidates: [], schemaReady: true });

      const [nextDocuments, designated, nextCandidates] = await Promise.all([
        docsPromise,
        designatedPromise,
        candidatesPromise,
      ]);

      setDocuments(nextDocuments);
      setRelease(designated.release);
      setInstaller(designated.installer);
      setCandidates(nextCandidates.candidates);
      setSchemaReady(designated.schemaReady && nextCandidates.schemaReady);
    } catch (requestError) {
      setError(pickApiErrorMessage(requestError, 'Não foi possível carregar a central APK'));
    } finally {
      setLoading(false);
    }
  }, [canDownloadApk, canDesignateApk]);

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

  const downloadInstaller = async () => {
    if (!installer) return;
    try {
      setBusy('installer');
      setError(null);
      const blob = await playerApkApi.downloadInstaller();
      saveBlob(blob, installer.filename || 'Instala-Player-TotemDigital.apk');
    } catch (requestError) {
      setError(pickApiErrorMessage(requestError, 'Não foi possível baixar o instalador'));
    } finally {
      setBusy(null);
    }
  };

  const designate = async (updateId: number) => {
    try {
      setBusy(`designate-${updateId}`);
      setError(null);
      await playerApkApi.designate(updateId);
      await load();
    } catch (requestError) {
      setError(pickApiErrorMessage(requestError, 'Não foi possível designar o APK'));
    } finally {
      setBusy(null);
    }
  };

  const uploadOfficial = async () => {
    if (!apkFile) {
      setError('Escolha o ficheiro Player-AD-release.apk');
      return;
    }
    const code = versionCode.trim() ? Number(versionCode) : undefined;
    if (code != null && (!Number.isInteger(code) || code < 1)) {
      setError('versionCode deve ser um inteiro positivo (ex.: 112)');
      return;
    }
    try {
      setBusy('upload');
      setError(null);
      await playerApkApi.uploadOfficial(apkFile, version.trim() || '2.12', code);
      setApkFile(null);
      await load();
    } catch (requestError) {
      setError(pickApiErrorMessage(requestError, 'Não foi possível enviar o APK'));
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
            Player-AD oficial (não altera o logo de boot) e instalador de campo
            (logo de boot + Player-AD). Download autenticado.
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={() => void load()}>Atualizar</Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {!schemaReady && (
        <Alert severity="error">
          Schema desatualizado: falta a tabela <strong>player_release_channels</strong> (ou colunas OTA).
          Em DEV/prod corra a actualização da instalação (<code>--modo atualizar</code>) e volte a esta aba.
        </Alert>
      )}

      {!canDownloadApk ? (
        <Alert severity="info">
          O download do APK é restrito à administração e à operação técnica.
        </Alert>
      ) : (
        <>
          {release ? (
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Só o player. <strong>Não altera o logo de boot.</strong>
                </Typography>
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
                  Baixar Player-AD (sem logo de boot)
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
              {canDesignateApk
                ? ' Envie o Player-AD 2.12 abaixo (funciona em Direct, sem o módulo OTA).'
                : ''}
            </Alert>
          )}

          {installer ? (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Android color="primary" />
                  <Typography variant="h6" fontWeight={700}>Instala-Player-TotemDigital</Typography>
                  <Chip size="small" color="primary" label="Campo · player + logos se necessário" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {installer.summary}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Ficheiro:</strong> {installer.filename}
                </Typography>
                <Typography variant="body2">
                  <strong>Tamanho:</strong> {bytesLabel(installer.fileSize)}
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={busy === 'installer' ? <CircularProgress size={16} color="inherit" /> : <Download />}
                  disabled={busy === 'installer'}
                  onClick={() => void downloadInstaller()}
                >
                  Baixar Instala-Player (logo de boot + Player-AD)
                </Button>
              </CardActions>
            </Card>
          ) : (
            <Alert severity="warning">
              Instala-Player-TotemDigital.apk ainda não está no servidor.
              Actualize a instalação (<code>--modo atualizar</code>) para o disponibilizar.
            </Alert>
          )}
        </>
      )}

      {canDesignateApk && schemaReady && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Designar Player-AD oficial
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Em modo Direct o menu OTA está desligado de propósito. Esta aba é a fonte oficial do APK
              (kit 2.12 / 112). O ficheiro fica em <code>uploads/ota-updates</code> no servidor.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <TextField
                size="small"
                label="Versão"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                sx={{ maxWidth: 140 }}
              />
              <TextField
                size="small"
                label="versionCode"
                value={versionCode}
                onChange={(event) => setVersionCode(event.target.value)}
                sx={{ maxWidth: 140 }}
              />
              <Button variant="outlined" component="label" startIcon={<Upload />}>
                {apkFile ? apkFile.name : 'Escolher .apk'}
                <input
                  hidden
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  onChange={(event) => setApkFile(event.target.files?.[0] || null)}
                />
              </Button>
              <Button
                variant="contained"
                disabled={busy === 'upload' || !apkFile}
                startIcon={busy === 'upload' ? <CircularProgress size={16} color="inherit" /> : <Upload />}
                onClick={() => void uploadOfficial()}
              >
                Enviar e designar
              </Button>
            </Stack>
            {candidates.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Pacotes já no servidor</Typography>
                <Stack spacing={1}>
                  {candidates.map((candidate) => (
                    <Stack
                      key={candidate.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Typography variant="body2">
                        Player-AD {candidate.version}
                        {candidate.versionCode ? ` · ${candidate.versionCode}` : ''}
                        {' · '}
                        {candidate.status}
                        {' · '}
                        {bytesLabel(candidate.fileSize)}
                      </Typography>
                      <Button
                        size="small"
                        disabled={busy === `designate-${candidate.id}` || release?.id === candidate.id}
                        onClick={() => void designate(candidate.id)}
                      >
                        {release?.id === candidate.id ? 'Oficial' : 'Designar oficial'}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
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
