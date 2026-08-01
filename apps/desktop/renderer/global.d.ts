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
    subscribe(callback: (snapshot: any) => void): () => void;
  };
}
