<<<<<<< HEAD
/**
 * Punto de entrada de TramitesBAR.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { App } from "@/App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("No se encontró el contenedor raíz #root en el documento.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
=======
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@fontsource-variable/archivo';
import '@fontsource-variable/public-sans';
import '@fontsource/ibm-plex-mono';
import './styles/main.css';

import { AuthProvider } from './context/AuthContext';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
