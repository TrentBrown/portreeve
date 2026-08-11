// @ts-check

/**
 * @typedef {{
 *   executable: string,
 *   applicationDirectory: string,
 *   socketPath: string,
 *   standardOutputPath: string,
 *   standardErrorPath: string
 * }} SupervisorDefinition
 *
 * @typedef {{
 *   kind: string,
 *   installed: boolean,
 *   active: boolean,
 *   mainPid: number | null
 * }} SupervisorState
 *
 * @typedef {{
 *   kind: string,
 *   definitionPath: string,
 *   renderDefinition(definition: SupervisorDefinition): string,
 *   state(context?: import('./deadline.js').LifecycleDeadline): Promise<SupervisorState>,
 *   installDefinition(content: string, context?: import('./deadline.js').LifecycleDeadline): Promise<void>,
 *   start(context?: import('./deadline.js').LifecycleDeadline): Promise<void>,
 *   stop(context?: import('./deadline.js').LifecycleDeadline): Promise<void>,
 *   uninstall(context?: import('./deadline.js').LifecycleDeadline): Promise<void>
 * }} Supervisor
 */

export {};
