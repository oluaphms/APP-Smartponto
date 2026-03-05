
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { initSentry } from './lib/sentry';
import { ThemeService } from './services/themeService';
import { i18n } from './lib/i18n';
import App from './App';
import { ToastProvider } from './src/components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';

initSentry();
ThemeService.init();
i18n.init();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
