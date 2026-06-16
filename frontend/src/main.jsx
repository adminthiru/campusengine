import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './store/AuthContext';
import { YearProvider } from './store/YearContext';
import App from './App';
import './i18n/index';
import './styles/global.css';
import 'react-datepicker/dist/react-datepicker.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
});

const antdTheme = {
  token: {
    colorPrimary: '#1a56e8',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    fontFamily: 'Inter, sans-serif',
    borderRadius: 10,
    fontSize: 14,
    lineWidth: 1.5,
    colorBorder: '#e2e8f0',
    colorTextPlaceholder: '#94a3b8',
    controlHeight: 43,
    controlPaddingHorizontal: 14,
  },
  components: {
    Select: {
      optionSelectedBg: '#eff6ff',
      optionActiveBg: '#f8fafc',
      singleItemHeightLG: 43,
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={antdTheme}>
          <AuthProvider>
            <YearProvider>
              <App />
              <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontFamily: 'Inter, sans-serif', fontSize: 14 } }} />
            </YearProvider>
          </AuthProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
