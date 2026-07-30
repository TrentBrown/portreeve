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
 *   state(): Promise<SupervisorState>,
 *   installDefinition(content: string): Promise<void>,
 *   start(): Promise<void>,
 *   stop(): Promise<void>,
 *   uninstall(): Promise<void>
 * }} Supervisor
 */

export {};
