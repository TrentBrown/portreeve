// @ts-check

export const PROTOCOL_VERSION = 1;

export const PROTOCOL_RANGE = Object.freeze({
  minimum: PROTOCOL_VERSION,
  maximum: PROTOCOL_VERSION,
});

export const CAPABILITIES = Object.freeze([
  'claims-v1',
  'two-phase-allocation-v1',
  'listener-evidence-v1',
  'reclamation-v1',
  'administration-v1',
  'observability-v1',
  'lifecycle-control-v1',
  'stack-definitions-v1',
  'stack-activations-v1',
  'stack-discovery-v1',
  'launcher-operations-v1',
  'mcp-foundations-v1',
]);

export const DOCKER_CAPABILITY = 'docker-evidence-v1';

export const LAUNCHER_OPERATION_TTL_MILLISECONDS = 30_000;
export const LAUNCHER_OPERATION_RENEW_AFTER_MILLISECONDS = 10_000;
export const LAUNCHER_OPERATION_HISTORY_LIMIT = 20;

export const EXIT_CODES = Object.freeze({
  success: 0,
  stateDifference: 10,
  conflict: 20,
  unavailable: 30,
  incompatible: 40,
  invalidInput: 50,
  internal: 70,
});

export const ERROR_CODES = Object.freeze({
  conflict: 'conflict',
  incompatibleProtocol: 'incompatible_protocol',
  invalidInput: 'invalid_input',
  invalidLeaseToken: 'invalid_lease_token',
  invalidOperationCredential: 'invalid_operation_credential',
  leaseExpired: 'lease_expired',
  leaseNotPending: 'lease_not_pending',
  notFound: 'not_found',
  unavailable: 'unavailable',
  internal: 'internal',
});
