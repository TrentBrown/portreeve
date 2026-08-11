interface Window {
  portreeveDesktop: {
    getSnapshot(): Promise<any>;
    refresh(): Promise<any>;
    installAndStart(): Promise<any>;
    start(): Promise<any>;
    stop(): Promise<any>;
    stopManual(): Promise<any>;
    restart(): Promise<any>;
    upgrade(): Promise<any>;
    uninstall(): Promise<any>;
    previewPurge(): Promise<any>;
    executePurge(confirmation: string): Promise<any>;
    openDownloadPage(): Promise<any>;
    applyStackDefinition(): Promise<any>;
    openStackDocument(): Promise<any>;
    openKnownStackDocument(id: string): Promise<any>;
    saveStackDocument(
      documentId: string,
      content: string,
      conflictToken?: string | null,
    ): Promise<any>;
    retryStackDocumentApply(documentId: string): Promise<any>;
    prepareStack(id: string): Promise<any>;
    reconcileStack(id: string): Promise<any>;
    endStack(id: string): Promise<any>;
    previewStackPrune(): Promise<any>;
    executeStackPrune(confirmation: string): Promise<any>;
    previewStackSnapshot(
      activationId: string,
      component: string,
      gatewayHost: string,
    ): Promise<any>;
    getLauncherSnapshot(): Promise<any>;
    openLauncherDocument(stackId: string): Promise<any>;
    saveLauncherDocument(
      documentId: string,
      definition: unknown,
      overwrite?: boolean,
      confirmDowngrade?: boolean,
    ): Promise<any>;
    beginLauncherAction(
      stackId: string,
      operation: 'start' | 'stop' | 'restart' | 'status',
      runStartAnyway?: boolean,
      allowDegraded?: boolean,
    ): Promise<any>;
    getLauncherSession(sessionId: string): Promise<any>;
    cancelLauncherSession(sessionId: string): Promise<any>;
    terminateLauncherAttached(stackId: string): Promise<any>;
    getLauncherOutput(sessionId: string): Promise<any>;
    saveLauncherOutput(sessionId: string): Promise<any>;
    copyText(text: string): Promise<any>;
    subscribe(callback: (snapshot: any) => void): () => void;
    subscribeLauncherOutput(callback: (event: any) => void): () => void;
    subscribeLauncherSessions(callback: (session: any) => void): () => void;
    subscribeApplicationCloseBlocked(callback: (state: any) => void): () => void;
    subscribeLifecycleActivity(callback: (activity: any) => void): () => void;
  };
}
