export type IssueInvoicesScope = 'all' | 'subscriber' | 'publisher';

export interface IssueInvoicesFormState {
  scope: IssueInvoicesScope;
  subscriberId: string;
  contractId: string;
  publisherId: string;
  publisherContractId: string;
  dueInDays: string;
}

export interface IssueInvoicesApiPayload {
  subscriberId?: number;
  contractId?: number;
  publisherId?: number;
  publisherContractId?: number;
  dueInDays?: number;
}

export function parseOptionalPositiveInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Monta body de POST /financial-admin/issue-invoices a partir do formulário. */
export function buildIssueInvoicesPayload(form: IssueInvoicesFormState): IssueInvoicesApiPayload {
  const payload: IssueInvoicesApiPayload = {};
  const dueInDays = parseOptionalPositiveInt(form.dueInDays);
  if (dueInDays) payload.dueInDays = dueInDays;

  const includeSubscriber = form.scope === 'subscriber' || form.scope === 'all';
  const includePublisher = form.scope === 'publisher' || form.scope === 'all';

  if (includeSubscriber) {
    const subscriberId = parseOptionalPositiveInt(form.subscriberId);
    const contractId = parseOptionalPositiveInt(form.contractId);
    if (subscriberId) payload.subscriberId = subscriberId;
    if (contractId) payload.contractId = contractId;
  }

  if (includePublisher) {
    const publisherId = parseOptionalPositiveInt(form.publisherId);
    const publisherContractId = parseOptionalPositiveInt(form.publisherContractId);
    if (publisherId) payload.publisherId = publisherId;
    if (publisherContractId) payload.publisherContractId = publisherContractId;
  }

  return payload;
}
