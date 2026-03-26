import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { msalConfig, AuthGuard } from "./auth";
import { Layout } from "./components/Layout";
import { DashboardList } from "./pages/DashboardList";
import { DashboardView } from "./pages/DashboardView";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AdminPage } from "./pages/AdminPage";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const msalInstance = DEV_MODE ? null : new PublicClientApplication(msalConfig);

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboards"
          element={
            <AuthGuard>
              <Layout>
                <DashboardList />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/dashboards/:id"
          element={
            <AuthGuard>
              <Layout>
                <DashboardView />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <AuthGuard>
              <Layout>
                <AdminPage />
              </Layout>
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/dashboards" replace />} />
      </Routes>
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
