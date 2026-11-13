/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' mounts the v2 app (src/ui/v2/App.tsx) instead of v1. */
  readonly VITE_V2?: string;
}
