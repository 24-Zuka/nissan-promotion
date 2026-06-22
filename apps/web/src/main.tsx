import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth.js';
import App from './App.js';
import AppErrorBoundary from './components/AppErrorBoundary.js';
import { ToastProvider } from './components/Toast.js';
import ScrollToTop from './components/ScrollToTop.js';
import { ThemeProvider } from './lib/theme.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// GitHub Pages のサブパス配信に合わせて basename を設定（'/' のときは空＝従来どおり）。
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter
          basename={basename}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <ScrollToTop />
          <AuthProvider>
            <ToastProvider>
              <AppErrorBoundary>
                <App />
              </AppErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
