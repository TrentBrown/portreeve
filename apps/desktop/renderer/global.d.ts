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
    subscribe(callback: (snapshot: any) => void): () => void;
  };
}
