# 📋 Guia para Completar Interface de Publisher Contracts

**Data:** 2026-01-08  
**Status:** ⏳ Em Progresso

---

## 📝 Resumo

Este documento descreve as alterações necessárias para completar a interface de gerenciamento de Publisher Contracts na página `frontend/src/pages/Contracts/Contracts.tsx`.

---

## ✅ O que já foi feito

1. ✅ Imports adicionados:
   - `publisherContractApi`
   - `PublisherContract`
   - `CreatePublisherContractRequest`
   - `UpdatePublisherContractRequest`

---

## 🔨 O que precisa ser feito

### 1. Adicionar Estados

Adicionar após os estados existentes (linha ~80-120):

```typescript
// Estados para Publisher Contracts
const [publisherContracts, setPublisherContracts] = useState<PublisherContract[]>([]);
const [createPublisherContractDialogOpen, setCreatePublisherContractDialogOpen] = useState(false);
const [editPublisherContractDialogOpen, setEditPublisherContractDialogOpen] = useState(false);
const [selectedPublisherContract, setSelectedPublisherContract] = useState<PublisherContract | null>(null);
const [mainTab, setMainTab] = useState(0); // 0 = Subscriber Contracts, 1 = Publisher Contracts

// Formulário de Publisher Contract
const [publisherContractForm, setPublisherContractForm] = useState<CreatePublisherContractRequest>({
  publisher_id: 0,
  contract_number: '',
  contract_type: 'revenue_share',
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  revenue_share_percentage: undefined,
  revenue_share_rules: undefined,
  minimum_payout_amount: undefined,
  subscription_amount: undefined,
  subscription_interval: 'month',
  currency: 'BRL',
  payment_terms: '',
  status: 'draft',
});
```

### 2. Adicionar Função de Carregamento

Adicionar após `loadContracts()`:

```typescript
const loadPublisherContracts = async () => {
  try {
    setLoading(true);
    setError(null);
    const response = await publisherContractApi.getAll({
      search: searchTerm || undefined,
      contractType: contractTypeFilter !== 'all' ? contractTypeFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      activeOnly: false,
    });
    setPublisherContracts(response.contracts || []);
  } catch (error: any) {
    console.error('Erro ao carregar contratos de publicadores:', error);
    setError('Erro ao carregar contratos de publicadores');
  } finally {
    setLoading(false);
  }
};
```

### 3. Atualizar useEffect

Modificar o `useEffect` existente (linha ~123):

```typescript
useEffect(() => {
  if (mainTab === 0) {
    loadContracts();
    loadSubscribers();
    loadPlans();
  } else {
    loadPublisherContracts();
    loadPublishers();
  }
}, [contractTypeFilter, statusFilter, mainTab]);
```

### 4. Adicionar Handlers

Adicionar após `handleDeleteContract()`:

```typescript
// Handlers para Publisher Contracts
const handleCreatePublisherContract = async () => {
  try {
    if (!publisherContractForm.publisher_id || !publisherContractForm.contract_number || !publisherContractForm.title || !publisherContractForm.start_date) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    await publisherContractApi.create(publisherContractForm);
    setCreatePublisherContractDialogOpen(false);
    resetPublisherContractForm();
    loadPublisherContracts();
  } catch (error: any) {
    console.error('Erro ao criar contrato de publicador:', error);
    setError(error?.response?.data?.error || error?.message || 'Erro ao criar contrato de publicador');
  }
};

const handleEditPublisherContract = async () => {
  if (!selectedPublisherContract) return;

  try {
    const updateData: UpdatePublisherContractRequest = {
      ...publisherContractForm,
    };

    await publisherContractApi.update(selectedPublisherContract.contract_id, updateData);
    setEditPublisherContractDialogOpen(false);
    resetPublisherContractForm();
    loadPublisherContracts();
  } catch (error: any) {
    console.error('Erro ao atualizar contrato de publicador:', error);
    setError(error?.response?.data?.error || error?.message || 'Erro ao atualizar contrato de publicador');
  }
};

const handleDeletePublisherContract = async (id: number) => {
  if (!window.confirm('Tem certeza que deseja excluir este contrato de publicador?')) return;

  try {
    await publisherContractApi.delete(id);
    loadPublisherContracts();
  } catch (error: any) {
    console.error('Erro ao excluir contrato de publicador:', error);
    setError(error?.response?.data?.error || error?.message || 'Erro ao excluir contrato de publicador');
  }
};

const handleStartEditPublisherContract = (contract: PublisherContract) => {
  setSelectedPublisherContract(contract);
  setPublisherContractForm({
    publisher_id: contract.publisher_id || 0,
    contract_number: contract.contract_number,
    contract_type: contract.contract_type,
    title: contract.title,
    description: contract.description || '',
    start_date: contract.start_date,
    end_date: contract.end_date || '',
    revenue_share_percentage: contract.revenue_share_percentage,
    revenue_share_rules: contract.revenue_share_rules,
    minimum_payout_amount: contract.minimum_payout_amount,
    subscription_amount: contract.subscription_amount,
    subscription_interval: contract.subscription_interval || 'month',
    currency: contract.currency,
    payment_terms: contract.payment_terms || '',
    status: contract.status,
  });
  setEditPublisherContractDialogOpen(true);
};

const resetPublisherContractForm = () => {
  setPublisherContractForm({
    publisher_id: 0,
    contract_number: '',
    contract_type: 'revenue_share',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    revenue_share_percentage: undefined,
    revenue_share_rules: undefined,
    minimum_payout_amount: undefined,
    subscription_amount: undefined,
    subscription_interval: 'month',
    currency: 'BRL',
    payment_terms: '',
    status: 'draft',
  });
  setSelectedPublisherContract(null);
};
```

### 5. Adicionar Tabs no Header

Modificar o header (após linha ~365) para incluir tabs:

```typescript
{/* Tabs para Subscriber/Publisher Contracts */}
<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
  <Tabs value={mainTab} onChange={(_, newValue) => setMainTab(newValue)}>
    <Tab label="Contratos Assinantes" icon={<People />} iconPosition="start" />
    <Tab label="Contratos Publicadores" icon={<Business />} iconPosition="start" />
  </Tabs>
</Box>
```

### 6. Modificar Botão de Adicionar

Modificar o botão "Adicionar Contrato" (linha ~376):

```typescript
<Button
  variant="contained"
  startIcon={<Add />}
  onClick={() => {
    if (mainTab === 0) {
      resetForm();
      setCreateDialogOpen(true);
      setCreateTab(0);
    } else {
      resetPublisherContractForm();
      setCreatePublisherContractDialogOpen(true);
    }
  }}
  sx={{
    backgroundColor: theme.palette.primary.main,
    '&:hover': { backgroundColor: theme.palette.primary.dark }
  }}
>
  {mainTab === 0 ? 'Adicionar Contrato' : 'Adicionar Contrato Publicador'}
</Button>
```

### 7. Adicionar Grid de Publisher Contracts

Após o grid de Subscriber Contracts (após linha ~610), adicionar:

```typescript
{/* Publisher Contracts Grid */}
{mainTab === 1 && (
  <Grid container spacing={3}>
    {publisherContracts.map((contract) => (
      <Grid item xs={12} sm={6} md={4} lg={3} key={contract.contract_id}>
        <Card sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[8],
          }
        }}>
          <Box sx={{ position: 'relative', height: 120, backgroundColor: theme.palette.grey[100] }}>
            <Avatar
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                color: theme.palette.secondary.main,
              }}
            >
              <Business />
            </Avatar>

            <Chip
              label={getStatusLabel(contract.status)}
              size="small"
              color={getStatusColor(contract.status) as any}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
              }}
            />
          </Box>

          <CardContent sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              {contract.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {contract.contract_number}
            </Typography>
            <Chip
              label={getContractTypeLabel(contract.contract_type)}
              size="small"
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" sx={{ mb: 1 }}>
              <Business sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
              Publicador #{contract.publisher_id}
            </Typography>
            {contract.revenue_share_percentage && (
              <Typography variant="body2" color="text.secondary">
                Revenue Share: {contract.revenue_share_percentage}%
              </Typography>
            )}
            {contract.subscription_amount && (
              <Typography variant="body2" color="text.secondary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: contract.currency }).format(contract.subscription_amount)} / {contract.subscription_interval}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              <CalendarToday sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
              {formatDate(contract.start_date)} - {contract.end_date ? formatDate(contract.end_date) : 'Sem término'}
            </Typography>
          </CardContent>

          <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => handleStartEditPublisherContract(contract)}
              sx={{ color: theme.palette.primary.main }}
            >
              <Edit />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleDeletePublisherContract(contract.contract_id)}
              sx={{ color: theme.palette.error.main }}
            >
              <Delete />
            </IconButton>
          </Box>
        </Card>
      </Grid>
    ))}
    {publisherContracts.length === 0 && !loading && (
      <Grid item xs={12}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Description sx={{ fontSize: 64, color: theme.palette.grey[300], mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Nenhum contrato de publicador encontrado
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Comece adicionando seus primeiros contratos de publicadores
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetPublisherContractForm();
                setCreatePublisherContractDialogOpen(true);
              }}
            >
              Adicionar Primeiro Contrato Publicador
            </Button>
          </CardContent>
        </Card>
      </Grid>
    )}
  </Grid>
)}
```

### 8. Adicionar Dialogs de Criação/Edição

Adicionar após os dialogs existentes (no final do componente, antes do `</Box>` final):

```typescript
{/* Create Publisher Contract Dialog */}
<Dialog
  open={createPublisherContractDialogOpen}
  onClose={() => {
    setCreatePublisherContractDialogOpen(false);
    resetPublisherContractForm();
  }}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>Adicionar Contrato Publicador</DialogTitle>
  <DialogContent>
    <TextField
      fullWidth
      label="Publicador *"
      select
      value={publisherContractForm.publisher_id || ''}
      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, publisher_id: Number(e.target.value) })}
      margin="normal"
      required
    >
      {publishers.map((publisher) => (
        <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
          {publisher.name}
        </MenuItem>
      ))}
    </TextField>

    <TextField
      fullWidth
      label="Número do Contrato *"
      value={publisherContractForm.contract_number}
      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_number: e.target.value })}
      margin="normal"
      required
    />

    <TextField
      fullWidth
      label="Título *"
      value={publisherContractForm.title}
      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, title: e.target.value })}
      margin="normal"
      required
    />

    <FormControl fullWidth margin="normal" required>
      <InputLabel>Tipo de Contrato *</InputLabel>
      <Select
        value={publisherContractForm.contract_type}
        label="Tipo de Contrato *"
        onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_type: e.target.value as any })}
      >
        <MenuItem value="revenue_share">Revenue Share</MenuItem>
        <MenuItem value="subscription">Assinatura</MenuItem>
        <MenuItem value="partnership">Parceria</MenuItem>
        <MenuItem value="hybrid">Híbrido</MenuItem>
      </Select>
    </FormControl>

    <TextField
      fullWidth
      label="Descrição"
      value={publisherContractForm.description}
      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, description: e.target.value })}
      margin="normal"
      multiline
      rows={3}
    />

    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Data de Início *"
          type="date"
          value={publisherContractForm.start_date}
          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, start_date: e.target.value })}
          margin="normal"
          required
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Data de Término"
          type="date"
          value={publisherContractForm.end_date || ''}
          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, end_date: e.target.value })}
          margin="normal"
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
    </Grid>

    {publisherContractForm.contract_type === 'revenue_share' && (
      <>
        <TextField
          fullWidth
          label="Percentual de Revenue Share (%)"
          type="number"
          value={publisherContractForm.revenue_share_percentage || ''}
          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, revenue_share_percentage: e.target.value ? Number(e.target.value) : undefined })}
          margin="normal"
          inputProps={{ min: 0, max: 100, step: 0.01 }}
        />
        <TextField
          fullWidth
          label="Valor Mínimo de Payout"
          type="number"
          value={publisherContractForm.minimum_payout_amount || ''}
          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, minimum_payout_amount: e.target.value ? Number(e.target.value) : undefined })}
          margin="normal"
        />
      </>
    )}

    {publisherContractForm.contract_type === 'subscription' && (
      <>
        <TextField
          fullWidth
          label="Valor da Assinatura"
          type="number"
          value={publisherContractForm.subscription_amount || ''}
          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_amount: e.target.value ? Number(e.target.value) : undefined })}
          margin="normal"
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Intervalo</InputLabel>
          <Select
            value={publisherContractForm.subscription_interval}
            label="Intervalo"
            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_interval: e.target.value })}
          >
            <MenuItem value="month">Mensal</MenuItem>
            <MenuItem value="four_month">Quadrimestral</MenuItem>
            <MenuItem value="semester">Semestral</MenuItem>
            <MenuItem value="year">Anual</MenuItem>
          </Select>
        </FormControl>
      </>
    )}

    <FormControl fullWidth margin="normal">
      <InputLabel>Status</InputLabel>
      <Select
        value={publisherContractForm.status}
        label="Status"
        onChange={(e) => setPublisherContractForm({ ...publisherContractForm, status: e.target.value as any })}
      >
        <MenuItem value="draft">Rascunho</MenuItem>
        <MenuItem value="active">Ativo</MenuItem>
        <MenuItem value="expired">Expirado</MenuItem>
        <MenuItem value="terminated">Terminado</MenuItem>
        <MenuItem value="cancelled">Cancelado</MenuItem>
      </Select>
    </FormControl>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => {
      setCreatePublisherContractDialogOpen(false);
      resetPublisherContractForm();
    }}>
      Cancelar
    </Button>
    <Button variant="contained" onClick={handleCreatePublisherContract}>
      Criar
    </Button>
  </DialogActions>
</Dialog>

{/* Edit Publisher Contract Dialog */}
<Dialog
  open={editPublisherContractDialogOpen}
  onClose={() => {
    setEditPublisherContractDialogOpen(false);
    resetPublisherContractForm();
  }}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>Editar Contrato Publicador</DialogTitle>
  <DialogContent>
    {/* Mesmo conteúdo do dialog de criação, mas usando publisherContractForm */}
    {/* ... (copiar conteúdo do dialog de criação) ... */}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => {
      setEditPublisherContractDialogOpen(false);
      resetPublisherContractForm();
    }}>
      Cancelar
    </Button>
    <Button variant="contained" onClick={handleEditPublisherContract}>
      Salvar
    </Button>
  </DialogActions>
</Dialog>
```

---

## 📝 Notas Importantes

1. **Proteção de Valores**: Lembrar de aplicar a mesma proteção de valores contratuais sensíveis que existe para Subscriber Contracts.

2. **Validações**: Adicionar validações apropriadas para campos obrigatórios e formatos.

3. **Loading States**: Garantir que os estados de loading funcionem corretamente ao alternar entre tabs.

4. **Filtros**: Os filtros existentes devem funcionar para ambos os tipos de contratos.

---

## ✅ Checklist

- [ ] Adicionar estados
- [ ] Adicionar função de carregamento
- [ ] Atualizar useEffect
- [ ] Adicionar handlers
- [ ] Adicionar tabs no header
- [ ] Modificar botão de adicionar
- [ ] Adicionar grid de Publisher Contracts
- [ ] Adicionar dialogs de criação/edição
- [ ] Testar funcionalidade completa
- [ ] Aplicar proteção de valores sensíveis

---

**Última Atualização:** 2026-01-08
