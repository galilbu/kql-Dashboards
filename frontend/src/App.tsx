import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { msalConfig, AuthGuard } from './auth';
import { Layout } from './components/Layout';
import { DashboardList } from './pages/DashboardList';
import { DashboardView } from './pages/DashboardView';

const msalInstance = new PublicClientApplication(msalConfig);

function App() {
  return (
    <MsalProvider instance={msalInstance}>
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
    </MsalProvider>
  );
}

export default App;
