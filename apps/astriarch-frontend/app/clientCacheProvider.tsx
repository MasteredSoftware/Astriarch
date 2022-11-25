import React, { useState } from "react";
import { CacheProvider } from "@emotion/react";
import { ClientStyleContext } from "./context";
import createEmotionCache from "./createEmotionCache";

interface ClientCacheProviderProps {
  children: React.ReactNode;
}

export default function ClientCacheProvider({ children }: ClientCacheProviderProps) {
  const [cache, setCache] = useState(createEmotionCache());

  function reset() {
    setCache(createEmotionCache());
  }

  return (
    <ClientStyleContext.Provider value={{ reset }}>
      <CacheProvider value={cache}>{children}</CacheProvider>
    </ClientStyleContext.Provider>
  );
}
