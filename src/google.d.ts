interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (cfg: {
          client_id: string;
          callback: (r: { credential: string }) => void;
          auto_select?: boolean;
        }) => void;
        renderButton: (el: HTMLElement, cfg: object) => void;
        prompt: () => void;
      };
    };
  };
}
