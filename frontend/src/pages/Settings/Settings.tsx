import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  TextField,
  Button,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  CircularProgress,
  Chip,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save,
  Refresh,
  Storage,
  RotateRight,
  Refresh as ReloadIcon,
  Warning,
  VideoLibrary,
  Build,
  Security,
  MonitorHeart,
  Shuffle,
  BugReport,
  ViewTimeline,
  Payment,
  Business,
  People,
  Android,
} from '@mui/icons-material';
import { settingsApi, SystemSetting, logsApi, LogRotationConfig, LogFileInfo, DiskSpaceInfo, RotationStatus, authApi } from '../../services/api';
import TwoFactor from './TwoFactor';
import ResponsiveSectionNav from '../../components/Navigation/ResponsiveSectionNav';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector } from '../../store';
import { canAccess, canAccessDispatcherHub } from '../../utils/rolePermissions';
import { normalizeAppRole } from '../../utils/userRoleUserType';
import { isDirectTotemMode } from '../../config/directTotemMode';
import { getPublishersPageTitle } from '../../config/productTerminology';
import PlayerApkSettings from '../../components/PlayerApkSettings/PlayerApkSettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/** Ordem estável na aba Mídias (upload → armazenamento). */
const MEDIA_SETTINGS_ORDER: string[] = [
  'media.upload.max_size',
  'media.upload.nginx_max_size',
  'media.upload.express_limit',
  'media.upload.proxy_timeout',
  'media.upload.allowed_types',
  'media.storage.path',
  'media.storage.quota_per_client',
  'media.storage.auto_cleanup',
  'media.storage.cleanup_days',
];

function sortFinancialSettings(list: SystemSetting[]): SystemSetting[] {
  const rank = (k: string) => {
    const i = FINANCIAL_SETTINGS_ORDER.indexOf(k);
    return i === -1 ? FINANCIAL_SETTINGS_ORDER.length + 1 : i;
  };
  return [...list].sort((a, b) => {
    const d = rank(a.key) - rank(b.key);
    return d !== 0 ? d : a.key.localeCompare(b.key);
  });
}

const SECRET_FINANCIAL_SETTING_KEYS = new Set([
  'financial.smtp_pass',
  'financial.whatsapp_api_token',
]);

function isSecretFinancialSetting(key: string): boolean {
  return SECRET_FINANCIAL_SETTING_KEYS.has(key);
}

function renderSettingField(
  s: SystemSetting,
  onChange: (key: string, value: string) => void
): React.ReactNode {
  const readOnly = isSettingReadOnly(s);
  if (s.type === 'boolean') {
    return (
      <FormControlLabel
        disabled={readOnly}
        control={
          <Switch
            checked={s.value === 'true' || s.value === true}
            onChange={(e) => onChange(s.key, e.target.checked.toString())}
            disabled={readOnly}
          />
        }
        label={s.description || s.key}
      />
    );
  }
  const multiline =
    s.type === 'json' ||
    s.type === 'array' ||
    s.key.includes('email_body') ||
    s.key.includes('whatsapp_message');
  const isSecret = isSecretFinancialSetting(s.key);
  return (
    <TextField
      fullWidth
      label={s.description || s.key}
      value={formatSettingValueForEdit(s)}
      onChange={(e) => onChange(s.key, e.target.value)}
      type={
        isSecret ? 'password' : s.type === 'number' ? 'number' : 'text'
      }
      multiline={multiline}
      minRows={multiline ? 4 : undefined}
      disabled={readOnly}
      helperText={
        isSecret
          ? 'Deixe em branco ao salvar para manter o valor atual.'
          : s.key.startsWith('financial.overdue_block_')
            ? 'Placeholders: {{subscriber_name}}, {{overdue_count}}, {{amount_total}}, {{grace_days}}, {{days_overdue}}, {{billing_url}}, {{invoice_list}}, {{merchant_name}}'
            : s.key === 'financial.merchant_whatsapp_number'
              ? 'Somente dígitos, com DDI (ex.: 5551999999999).'
              : s.key === 'financial.whatsapp_phone_number_id'
                ? 'ID numérico do número WhatsApp na Meta Business.'
                : s.type === 'json' || s.type === 'array'
                  ? 'Edite como JSON válido.'
                  : undefined
      }
    />
  );
}

function sortMediaSettings(list: SystemSetting[]): SystemSetting[] {
  const rank = (k: string) => {
    const i = MEDIA_SETTINGS_ORDER.indexOf(k);
    return i === -1 ? MEDIA_SETTINGS_ORDER.length + 1 : i;
  };
  return [...list].sort((a, b) => {
    const d = rank(a.key) - rank(b.key);
    return d !== 0 ? d : a.key.localeCompare(b.key);
  });
}

/** Alinhado ao backend: só leitura quando `is_editable` é falso (boolean, 0 ou string legada). */
function isSettingReadOnly(s: SystemSetting): boolean {
  const v = s.isEditable ?? (s as any).is_editable;
  return v === false || v === 0 || v === '0' || v === 'false';
}

function formatSettingValueForEdit(s: SystemSetting): string {
  if (s.type === 'json' || s.type === 'array') {
    return typeof s.value === 'string' ? s.value : JSON.stringify(s.value ?? (s.type === 'array' ? [] : {}), null, 2);
  }
  return String(s.value ?? '');
}

function parseSettingValueForSave(s: SystemSetting): any {
  if (s.type === 'boolean') {
    return s.value === true || s.value === 'true' || s.value === '1' || s.value === 1;
  }
  if (s.type === 'number') {
    const n = typeof s.value === 'number' ? s.value : parseFloat(String(s.value ?? '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  if ((s.type === 'json' || s.type === 'array') && typeof s.value === 'string') {
    const trimmed = s.value.trim();
    if (!trimmed) return s.type === 'array' ? [] : {};
    return JSON.parse(trimmed);
  }
  return s.value;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ALL_SETTINGS_SECTIONS = [
  { id: 'general', label: 'Geral', icon: SettingsIcon },
  { id: 'apk', label: 'APK', icon: Android },
  { id: 'financial', label: 'Financeiro', icon: Payment },
  { id: 'logs', label: 'Logs', icon: Storage },
  { id: 'media', label: 'Mídias', icon: VideoLibrary },
  { id: 'dispatcher', label: 'Dispatcher', icon: MonitorHeart },
  { id: '2fa', label: '2FA', icon: Security },
  { id: 'password', label: 'Senha', icon: Security },
] as const;

type SettingsSectionId = (typeof ALL_SETTINGS_SECTIONS)[number]['id'];

const FINANCIAL_SETTINGS_ORDER: string[] = [
  'financial.worker_enabled',
  'financial.smtp_enabled',
  'financial.smtp_host',
  'financial.smtp_port',
  'financial.smtp_secure',
  'financial.smtp_user',
  'financial.smtp_pass',
  'financial.smtp_from',
  'financial.smtp_tls_reject_unauthorized',
  'financial.whatsapp_api_token',
  'financial.whatsapp_phone_number_id',
  'financial.whatsapp_api_version',
  'financial.merchant_whatsapp_number',
  'financial.block_publish_on_overdue',
  'financial.block_publish_overdue_grace_days',
  'financial.auto_pause_campaigns_on_block',
  'financial.admin_override_overdue_block',
  'financial.notify_block_email_enabled',
  'financial.notify_block_whatsapp_enabled',
  'financial.overdue_block_email_subject',
  'financial.overdue_block_email_body',
  'financial.overdue_block_whatsapp_message',
];

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const { user } = useAppSelector((state) => state.auth);
  const directTotem = isDirectTotemMode();
  const settingsSections = useMemo(
    () => ALL_SETTINGS_SECTIONS.filter((section) => !(directTotem && section.id === 'financial')),
    [directTotem]
  );
  const sectionIndex = useMemo(() => {
    const map: Partial<Record<SettingsSectionId, number>> = {};
    settingsSections.forEach((section, index) => {
      map[section.id] = index;
    });
    return map;
  }, [settingsSections]);
  const canDispatcherHub = canAccessDispatcherHub(user?.role, user?.flags ?? undefined);
  const role = user?.role ? normalizeAppRole(user.role) : '';
  const canManageUsers =
    !!role &&
    (role === 'owner_system' || role === 'admin' || role === 'admin_sql') &&
    canAccess(role, '/users', user?.flags ?? undefined);
  const canManageOta = !!role && canAccess(role, '/ota-updates', user?.flags ?? undefined);
  const canDownloadApk =
    !!role &&
    ['owner_system', 'admin_sql', 'admin', 'operator', 'operador_tecnico'].includes(role);
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [logSettings, setLogSettings] = useState<SystemSetting[]>([]);
  const [mediaSettings, setMediaSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Logs monitoring
  const [logConfig, setLogConfig] = useState<LogRotationConfig | null>(null);
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [diskSpace, setDiskSpace] = useState<DiskSpaceInfo | null>(null);
  const [rotationStatus, setRotationStatus] = useState<RotationStatus | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Media config
  const [applyingMediaConfig, setApplyingMediaConfig] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const activeSectionId = settingsSections[tabValue]?.id ?? 'general';

  useEffect(() => {
    if (tabValue >= settingsSections.length) {
      setTabValue(0);
    }
  }, [settingsSections.length, tabValue]);

  useEffect(() => {
    loadSettings();
    if (activeSectionId === 'logs') {
      loadLogsInfo();
    }
  }, [tabValue, activeSectionId]);
  
  const handleApplyMediaConfig = async (rebuild: boolean = false) => {
    try {
      setApplyingMediaConfig(true);
      setError(null);
      
      const response = await fetch('/api/settings/media/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          applyChanges: true,
          rebuild
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.message || 'Erro ao aplicar configurações');
        return;
      }
      
      alert('✅ Configurações de mídia aplicadas com sucesso!\n\n' +
            'Mudanças aplicadas:\n' +
            `- Nginx: ${result.data?.changes?.nginx ? 'Sim' : 'Não'}\n` +
            `- Express: ${result.data?.changes?.express ? 'Sim' : 'Não'}\n` +
            `- Multer: ${result.data?.changes?.multer ? 'Sim' : 'Não'}\n` +
            `- Serviços reiniciados: ${result.data?.changes?.servicesRestarted ? 'Sim' : 'Não'}`);
      
      if (result.data?.errors && result.data.errors.length > 0) {
        alert(
          'Avisos ao aplicar configurações:\n\n' +
            result.data.errors.map((x: unknown) => String(x)).join('\n')
        );
      }
      
    } catch (e: any) {
      setError('Erro ao aplicar configurações: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setApplyingMediaConfig(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const resp = await settingsApi.getAll();
      
      // A API retorna um objeto com categories, precisamos extrair todas as settings
      let allSettings: SystemSetting[] = [];
      if (Array.isArray(resp)) {
        // Se já for array, usar diretamente
        allSettings = resp;
      } else if (resp && typeof resp === 'object' && 'categories' in resp) {
        // Se for objeto com categories, extrair todas as settings
        const categories = (resp as any).categories || [];
        allSettings = categories.flatMap((cat: any) => cat.settings || []);
      } else if (resp && typeof resp === 'object') {
        // Se for objeto simples, tentar converter
        allSettings = Object.values(resp) as SystemSetting[];
      }
      
      setSettings(Array.isArray(allSettings) ? allSettings : []);
      
      // Separar configurações de logs
      const logs = allSettings.filter(s => s?.key?.startsWith('log.'));
      setLogSettings(Array.isArray(logs) ? logs : []);
      
      // Separar configurações de mídia
      const media = allSettings.filter(s => s?.key?.startsWith('media.'));
      setMediaSettings(Array.isArray(media) ? media : []);
    } catch (e) {
      setError('Erro ao carregar configurações');
      setSettings([]);
      setLogSettings([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLogsInfo = async () => {
    try {
      setLoadingLogs(true);
      const [config, files, space, status] = await Promise.all([
        logsApi.getConfig(),
        logsApi.getFiles(),
        logsApi.getDiskSpace(),
        logsApi.getRotationStatus()
      ]);
      setLogConfig(config);
      setLogFiles(files);
      // Garantir que percentUsed seja sempre número
      if (space) {
        setDiskSpace({
          ...space,
          percentUsed: typeof space.percentUsed === 'number' 
            ? space.percentUsed 
            : parseFloat(String(space.percentUsed || 0))
        });
      } else {
        setDiskSpace(null);
      }
      setRotationStatus(status);
    } catch {
      /* painel de logs opcional em caso de falha parcial */
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      let settingsToSave: SystemSetting[] = [];
      if (activeSectionId === 'general') {
        settingsToSave = generalSettings.filter((s) => s?.key && !isSettingReadOnly(s));
      } else if (activeSectionId === 'financial') {
        settingsToSave = financialSettings.filter((s) => s?.key && !isSettingReadOnly(s));
      } else if (activeSectionId === 'logs') {
        settingsToSave = Array.isArray(logSettings)
          ? logSettings.filter((s) => s?.key && !isSettingReadOnly(s))
          : [];
      } else if (activeSectionId === 'media') {
        settingsToSave = Array.isArray(mediaSettings)
          ? mediaSettings.filter((s) => s?.key && !isSettingReadOnly(s))
          : [];
      }

      // Converter para formato esperado pelo backend
      const settingsObj: { [key: string]: any } = {};
      settingsToSave.forEach((s) => {
        settingsObj[s.key] = parseSettingValueForSave(s);
      });

      if (Object.keys(settingsObj).length === 0) {
        return;
      }

      await settingsApi.updateMultiple(settingsObj);
      
      // Recarregar logger se foram alteradas configurações de logs
      if (activeSectionId === 'logs') {
        await logsApi.reload();
        await loadLogsInfo();
      }
      
      // Recarregar configurações após salvar
      await loadSettings();
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao salvar configurações. Verifique se campos JSON estão válidos.'));
    }
  };

  const handleRotateLogs = async () => {
    try {
      setLoadingLogs(true);
      await logsApi.rotate();
      await loadLogsInfo();
    } catch (e: any) {
      setError('Erro ao rotacionar logs: ' + e.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    const touch = (list: SystemSetting[]) =>
      list.find((x) => x.key === key);
    const cur =
      touch(settings) || touch(logSettings) || touch(mediaSettings);
    if (cur && isSettingReadOnly(cur)) {
      return;
    }
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
    if (key.startsWith('log.')) {
      setLogSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
    }
    if (key.startsWith('media.')) {
      setMediaSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
    }
  };

  const sortedMediaSettings = useMemo(
    () => sortMediaSettings(Array.isArray(mediaSettings) ? mediaSettings : []),
    [mediaSettings]
  );

  const financialSettings = useMemo(
    () =>
      sortFinancialSettings(
        (Array.isArray(settings) ? settings : []).filter((s) => s?.key?.startsWith('financial.'))
      ),
    [settings]
  );

  const generalSettings = useMemo(
    () =>
      (Array.isArray(settings) ? settings : []).filter(
        (s) =>
          s?.key &&
          !s.key.startsWith('log.') &&
          !s.key.startsWith('media.') &&
          !s.key.startsWith('financial.')
      ),
    [settings]
  );

  const handlePasswordFieldChange = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
    if (passwordSuccess) setPasswordSuccess(null);
  };

  const handleChangePassword = async () => {
    try {
      setError(null);
      setPasswordSuccess(null);

      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        setError('Preencha todos os campos de senha.');
        return;
      }
      if (passwordForm.newPassword.length < 6) {
        setError('A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setError('A confirmação da nova senha não confere.');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Sessão inválida. Faça login novamente.');
        return;
      }

      setChangingPassword(true);
      await authApi.changePassword(token, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordSuccess('Senha alterada com sucesso.');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao alterar senha.'));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: { xs: 2.5, md: 4 }, fontSize: { xs: '1.4rem', md: undefined } }}>
        Configurações do Sistema
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <ResponsiveSectionNav
          sections={settingsSections}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="settings"
        />
      </Paper>

      <TabPanel value={tabValue} index={sectionIndex.general ?? 0}>
        {directTotem && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardActionArea component={RouterLink} to="/publishers">
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Business color="primary" />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {getPublishersPageTitle()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Edite nome, contato e e-mail da organização única deste totem.
                  </Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
        {directTotem && canManageUsers && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardActionArea component={RouterLink} to="/users">
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <People color="primary" />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Usuários e direitos de acesso (RBAC)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Cadastre utilizadores, funções e flags de acesso. Apenas administradores podem
                    gerir utilizadores; as permissões seguem o plano RBAC da plataforma.
                  </Typography>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
        {!directTotem && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Glossário: limites, plano e contrato
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              Os <strong>tetos</strong> (quantidade de mídias, playlists, campanhas, armazenamento, etc.) vêm do{' '}
              <strong>plano</strong> ligado ao <strong>contrato ativo</strong> do anunciante (campo JSON{' '}
              <code>limits</code> no plano). O que o plano não define usa os defaults do sistema (
              <code>limits.defaults.*</code> nas configurações). Valor numérico <strong>0</strong> nesses tetos significa{' '}
              <strong>sem teto</strong> nessa métrica — não confundir com &quot;custo zero&quot; ou ausência de regra
              operacional. Totais agregados no Dashboard são informativos; o detalhe por anunciante está em{' '}
              <strong>Anunciantes</strong>.
            </Typography>
          </CardContent>
        </Card>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadSettings}>Recarregar</Button>
          <Button startIcon={<Save />} variant="contained" onClick={handleSave}>Salvar Alterações</Button>
        </Box>

        <Grid container spacing={3}>
          {generalSettings.map((s) => (
            <Grid item xs={12} md={6} key={s.key}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {s.key}
                    {isSettingReadOnly(s) && (
                      <Chip
                        label="Somente leitura"
                        size="small"
                        sx={{ ml: 1, verticalAlign: 'middle' }}
                        variant="outlined"
                      />
                    )}
                  </Typography>
                  {renderSettingField(s, handleChange)}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={sectionIndex.apk ?? -1}>
        <PlayerApkSettings canManageOta={canManageOta} canDownloadApk={canDownloadApk} />
      </TabPanel>

      {sectionIndex.financial != null && (
      <TabPanel value={tabValue} index={sectionIndex.financial}>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Integrações, inadimplência e notificações
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              Configure aqui o <strong>SMTP</strong>, o <strong>WhatsApp Meta Cloud API</strong> e o{' '}
              <strong>worker financeiro</strong> (crons de faturas, lembretes e bloqueio). Valores do{' '}
              <code>.env</code> servem como fallback quando o campo está vazio. Sem API WhatsApp, o e-mail inclui link{' '}
              <code>wa.me</code> para encaminhamento manual.
            </Typography>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadSettings}>
            Recarregar
          </Button>
          <Button startIcon={<Save />} variant="contained" onClick={handleSave}>
            Salvar Alterações
          </Button>
        </Box>

        <Grid container spacing={3}>
          {loading && financialSettings.length === 0 ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            </Grid>
          ) : financialSettings.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="warning">
                Nenhum parâmetro financeiro encontrado na base. Clique em <strong>Recarregar</strong>. Se
                persistir, atualize o backend e reaplique <code>seeds-default-settings.sql</code>.
              </Alert>
            </Grid>
          ) : null}
          {financialSettings.map((s) => (
            <Grid
              item
              xs={12}
              md={
                s.key.includes('email_body') ||
                s.key.includes('whatsapp_message') ||
                isSecretFinancialSetting(s.key)
                  ? 12
                  : 6
              }
              key={s.key}
            >
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {s.key}
                  </Typography>
                  {renderSettingField(s, handleChange)}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>
      )}

      <TabPanel value={tabValue} index={sectionIndex.logs ?? -1}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadLogsInfo} disabled={loadingLogs}>
            Atualizar Informações
          </Button>
          <Button startIcon={<RotateRight />} variant="outlined" onClick={handleRotateLogs} disabled={loadingLogs}>
            Rotacionar Logs Agora
          </Button>
          <Button startIcon={<ReloadIcon />} variant="outlined" onClick={async () => {
            await logsApi.reload();
            await loadLogsInfo();
          }} disabled={loadingLogs}>
            Recarregar Logger
          </Button>
          <Button startIcon={<Save />} variant="contained" onClick={handleSave} disabled={loadingLogs}>
            Salvar Configurações
          </Button>
        </Box>

        {loadingLogs && <LinearProgress sx={{ mb: 2 }} />}

        {/* Informações de Espaço em Disco */}
        {diskSpace && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Storage sx={{ mr: 1, verticalAlign: 'middle' }} />
                Espaço em Disco
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Total</Typography>
                  <Typography variant="h6">{diskSpace.totalFormatted}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Usado</Typography>
                  <Typography variant="h6">{diskSpace.usedFormatted}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={diskSpace.percentUsed}
                    color={diskSpace.percentUsed > 80 ? 'error' : diskSpace.percentUsed > 60 ? 'warning' : 'success'}
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {typeof diskSpace.percentUsed === 'number' 
                      ? diskSpace.percentUsed.toFixed(2) 
                      : parseFloat(String(diskSpace.percentUsed || 0)).toFixed(2)}% usado
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Livre</Typography>
                  <Typography variant="h6" color={parseFloat(diskSpace.percentFree) < 20 ? 'error' : 'success'}>
                    {diskSpace.freeFormatted}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Status de Rotação */}
        {rotationStatus && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status de Rotação
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Chip
                  label={rotationStatus.needsRotation ? 'Rotação Necessária' : 'Tudo OK'}
                  color={rotationStatus.needsRotation ? 'warning' : 'success'}
                  icon={rotationStatus.needsRotation ? <Warning /> : undefined}
                  sx={{ mb: 1 }}
                />
                {rotationStatus.reason !== 'none' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Motivo: {rotationStatus.reason}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Configurações de Logs */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configurações de Rotação
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {logSettings.map((s) => {
                const readOnly = isSettingReadOnly(s);
                return (
                  <Grid item xs={12} md={6} key={s.key}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {s.key}
                      {readOnly && (
                        <Chip
                          label="Somente leitura"
                          size="small"
                          sx={{ ml: 1, verticalAlign: 'middle' }}
                          variant="outlined"
                        />
                      )}
                    </Typography>
                    {s.type === 'boolean' ? (
                      <FormControlLabel
                        disabled={readOnly}
                        control={
                          <Switch
                            checked={s.value === 'true' || s.value === true}
                            onChange={(e) => handleChange(s.key, e.target.checked.toString())}
                            disabled={readOnly}
                          />
                        }
                        label={s.description || s.key}
                      />
                    ) : (
                      <TextField
                        fullWidth
                        label={s.description || s.key}
                        value={formatSettingValueForEdit(s)}
                        onChange={(e) => handleChange(s.key, e.target.value)}
                        type={s.type === 'number' ? 'number' : 'text'}
                        multiline={s.type === 'json' || s.type === 'array'}
                        minRows={s.type === 'json' || s.type === 'array' ? 4 : undefined}
                        disabled={readOnly}
                        helperText={
                          s.type === 'json' || s.type === 'array'
                            ? 'Edite como JSON válido.'
                            : s.key === 'log.rotation.max_size' || s.key === 'log.rotation.min_free_space'
                            ? 'Formato: 100MB, 1GB, etc.'
                            : undefined
                        }
                      />
                    )}
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>

        {/* Lista de Arquivos de Log */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Arquivos de Log ({logFiles.length})
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell align="right">Tamanho</TableCell>
                    <TableCell>Idade (dias)</TableCell>
                    <TableCell>Modificado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logFiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        Nenhum arquivo de log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    logFiles.map((file) => (
                      <TableRow key={file.name}>
                        <TableCell>{file.name}</TableCell>
                        <TableCell align="right">{file.sizeFormatted}</TableCell>
                        <TableCell>{file.age}</TableCell>
                        <TableCell>{new Date(file.modified).toLocaleString('pt-BR')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={sectionIndex.media ?? -1}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadSettings}>
            Recarregar
          </Button>
          <Button startIcon={<Save />} variant="contained" onClick={handleSave}>
            Salvar Configurações
          </Button>
          <Button 
            startIcon={<Build />} 
            variant="contained" 
            color="secondary"
            onClick={() => handleApplyMediaConfig(false)}
            disabled={applyingMediaConfig}
          >
            Aplicar Configurações (Nginx)
          </Button>
        </Box>

        {applyingMediaConfig && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Como funciona:</strong> As configurações são aplicadas automaticamente ao salvar. 
            O Express e Multer leem as configurações diretamente do banco de dados em tempo de execução.
            Para aplicar mudanças no Nginx (que requer modificação de arquivo), clique em "Aplicar Configurações (Nginx)".
            Isso atualizará o arquivo de configuração do Nginx e recarregará o serviço sem downtime.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          {sortedMediaSettings.map((s) => {
            const readOnly = isSettingReadOnly(s);
            return (
              <Grid item xs={12} md={6} key={s.key}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {s.description || s.key}
                      {readOnly && (
                        <Chip
                          label="Somente leitura"
                          size="small"
                          sx={{ ml: 1, verticalAlign: 'middle' }}
                          variant="outlined"
                        />
                      )}
                    </Typography>
                    {s.type === 'boolean' ? (
                      <FormControlLabel
                        disabled={readOnly}
                        control={
                          <Switch
                            checked={s.value === 'true' || s.value === true}
                            onChange={(e) => handleChange(s.key, e.target.checked.toString())}
                            disabled={readOnly}
                          />
                        }
                        label={s.description || s.key}
                      />
                    ) : s.type === 'number' ? (
                      <TextField
                        fullWidth
                        label={s.description || s.key}
                        value={String(s.value ?? '')}
                        onChange={(e) => handleChange(s.key, e.target.value)}
                        type="number"
                        disabled={readOnly}
                        helperText={s.validation ? `Validação: ${s.validation}` : undefined}
                      />
                    ) : (
                      <TextField
                        fullWidth
                        label={s.description || s.key}
                        value={formatSettingValueForEdit(s)}
                        onChange={(e) => handleChange(s.key, e.target.value)}
                        disabled={readOnly}
                        multiline={s.type === 'json' || s.type === 'array'}
                        minRows={s.type === 'json' || s.type === 'array' ? 4 : undefined}
                        helperText={
                          s.type === 'json' || s.type === 'array'
                            ? 'Edite como JSON válido.'
                            : s.key.includes('size') || s.key.includes('quota')
                            ? 'Formato: número seguido de unidade (ex: 500MB, 1GB)'
                            : s.validation
                              ? `Validação: ${s.validation}`
                              : undefined
                        }
                      />
                    )}
                    {s.defaultValue && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Valor padrão: {s.defaultValue}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {sortedMediaSettings.length === 0 && (
          <Alert severity="warning">
            Nenhuma configuração de mídia encontrada. Certifique-se de que as configurações foram inseridas no banco de dados.
          </Alert>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={sectionIndex.dispatcher ?? -1}>
        <Typography variant="body2" color="text.secondary" paragraph sx={{ maxWidth: 720 }}>
          Aceda às ferramentas do dispatcher para acompanhar mensagens, pedidos e ficheiros entre o servidor e os
          totens, e o fluxo ligado a playlists e publicidades. Cada cartão abre a área dedicada (e mantém o menu
          lateral completo).
        </Typography>
        {!canDispatcherHub ? (
          <Alert severity="info">
            O seu perfil não tem permissão para o dispatcher (ou falta a flag técnica). Contacte um administrador se
            precisar de acesso.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} to="/dispatcher-manager">
                  <CardContent>
                    <Shuffle sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Gerenciar
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Planos de envio, totem alvo e disparos manuais ou em lote.
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} to="/dispatcher-monitor">
                  <CardContent>
                    <MonitorHeart sx={{ fontSize: 36, color: 'success.main', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Monitor em tempo real
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fluxo de mensagens e eventos entre servidor e totens (WebSocket).
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} to="/dispatcher-debug">
                  <CardContent>
                    <BugReport sx={{ fontSize: 36, color: 'warning.main', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Debug online
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Redis, consultas, mensagens e estatísticas para diagnóstico técnico.
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} to="/dispatcher-manager?tab=timeline">
                  <CardContent>
                    <ViewTimeline sx={{ fontSize: 36, color: 'secondary.main', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Timeline
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Vista temporal dos envios e do plano por janela de tempo.
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={sectionIndex['2fa'] ?? -1}>
        <TwoFactor />
      </TabPanel>

      <TabPanel value={tabValue} index={sectionIndex.password ?? -1}>
        {passwordSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPasswordSuccess(null)}>
            {passwordSuccess}
          </Alert>
        )}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Alterar senha
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Senha atual"
                  value={passwordForm.currentPassword}
                  onChange={(e) => handlePasswordFieldChange('currentPassword', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Nova senha"
                  value={passwordForm.newPassword}
                  onChange={(e) => handlePasswordFieldChange('newPassword', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Confirmar nova senha"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handlePasswordFieldChange('confirmPassword', e.target.value)}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={changingPassword ? <CircularProgress size={16} color="inherit" /> : <Save />}
                disabled={changingPassword}
                onClick={handleChangePassword}
              >
                {changingPassword ? 'Salvando...' : 'Atualizar senha'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </TabPanel>
    </Box>
  );
};

export default Settings;
