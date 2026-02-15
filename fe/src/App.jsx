import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleRoute from './components/ModuleRoute';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import LeadsPage from './pages/LeadsPage';
import LeadCreatePage from './pages/LeadCreatePage';
import LeadDetailsPage from './pages/LeadDetailsPage';
import ClientsPage from './pages/ClientsPage';
import ClientCreatePage from './pages/ClientCreatePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailsPage from './pages/ProjectDetailsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailsPage from './pages/InvoiceDetailsPage';
import InvoicePdfPage from './pages/InvoicePdfPage';
import { APP_MODULES } from './constants/modules';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={(
            <ModuleRoute moduleKey={APP_MODULES.DASHBOARD}>
              <DashboardPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="leads"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.LEADS}>
              <LeadsPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="leads/new"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.LEADS}>
              <LeadCreatePage />
            </ModuleRoute>
          )}
        />
        <Route
          path="leads/:id"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.LEADS}>
              <LeadDetailsPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="clients"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.CLIENTS}>
              <ClientsPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="clients/new"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.CLIENTS}>
              <ClientCreatePage />
            </ModuleRoute>
          )}
        />
        <Route
          path="projects"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.PROJECTS}>
              <ProjectsPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="projects/:id"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.PROJECTS}>
              <ProjectDetailsPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="invoices"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.INVOICES}>
              <InvoicesPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="invoices/:id"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.INVOICES}>
              <InvoiceDetailsPage />
            </ModuleRoute>
          )}
        />
        <Route
          path="invoices/:id/pdf"
          element={(
            <ModuleRoute moduleKey={APP_MODULES.INVOICES}>
              <InvoicePdfPage />
            </ModuleRoute>
          )}
        />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
