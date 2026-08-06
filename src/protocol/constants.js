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
]);

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
  leaseExpired: 'lease_expired',
  leaseNotPending: 'lease_not_pending',
  notFound: 'not_found',
  unavailable: 'unavailable',
  internal: 'internal',
});
