/**
 * Compat: re-exporta o lifecycle (Etapa F).
 * Preferir `operationalWorkersLifecycle` em código novo.
 */
export {
  initializeOperationalWorkers,
  stopOperationalWorkers,
  reconcileOperationalWorkers,
  reconcileWorkersFromCapabilities,
  getAppliedOperationalWorkerFlags,
  resetOperationalWorkersStateForTests,
  type OperationalWorkersOptions,
  type WorkerRuntimeFlags,
} from './operationalWorkersLifecycle';
