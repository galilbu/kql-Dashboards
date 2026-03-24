import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { msalConfig, AuthGuard } from './auth';
import { Layout } from './components/Layout';
import { DashboardList } from './pages/DashboardList';
import { DashboardView } from './pages/DashboardView';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const msalInstance = DEV_MODE ? null : new PublicClientApplication(msalConfig);

function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Layout>
          <Routes>
            <Route path="/dashboards" element={<DashboardList />} />
            <Route path="/dashboards/:id" element={<DashboardView />} />
            <Route path="*" element={<Navigate to="/dashboards" replace />} />
          </Routes>
        </Layout>
      </AuthGuard>
    </BrowserRouter>
  );
}

function App() {
  if (DEV_MODE) {
    return <AppRoutes />;
  }

  return (
    <MsalProvider instance={msalInstance!}>
      <AppRoutes />
    </MsalProvider>
  );
}

export default App;
