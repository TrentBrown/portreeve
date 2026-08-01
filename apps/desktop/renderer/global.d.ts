interface Window {
  portreeveDesktop: {
    getSnapshot(): Promise<any>;
    refresh(): Promise<any>;
    subscribe(callback: (snapshot: any) => void): () => void;
  };
}
