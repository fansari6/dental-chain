import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout, RequireRole } from './components/Layout';
import LoginPage           from './pages/LoginPage';
import DashboardPage       from './pages/DashboardPage';
import GovernmentPage      from './pages/GovernmentPage';
import ManufacturerPage    from './pages/ManufacturerPage';
import DistributorPage     from './pages/DistributorPage';
import SupplyChainPage     from './pages/SupplyChainPage';
import NursePage           from './pages/NursePage';
import InfectionPrevPage   from './pages/InfectionPrevPage';
import BulkImportPage   from './pages/BulkImportPage';
import SurgeonPage         from './pages/SurgeonPage';
import AdminPage           from './pages/AdminPage';
import CasesPage          from './pages/CasesPage';
import NotificationsPage  from './pages/NotificationsPage';
import AnalyticsPage      from './pages/AnalyticsPage';
import OnboardingPage     from './pages/OnboardingPage';
import AuditPage          from './pages/AuditPage';
import CompliancePage     from './pages/CompliancePage';
import HistoryPage         from './pages/HistoryPage';
import VerificationPage    from './pages/VerificationPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history"    element={<HistoryPage />} />
            <Route path="/cases" element={
              <RequireRole roles={['nurse','supply_chain','surgeon','admin']}>
                <CasesPage />
              </RequireRole>
            } />
            <Route path="/notifications" element={
              <RequireRole roles={['admin']}>
                <NotificationsPage />
              </RequireRole>
            } />
            <Route path="/analytics" element={
              <RequireRole roles={['admin']}>
                <AnalyticsPage />
              </RequireRole>
            } />
            <Route path="/onboarding" element={
              <RequireRole roles={['admin']}>
                <OnboardingPage />
              </RequireRole>
            } />
            <Route path="/audit"      element={
              <RequireRole roles={['admin','government']}>
                <AuditPage />
              </RequireRole>
            } />
            <Route path="/compliance" element={
              <RequireRole roles={['government','infection_prevention','admin','nurse','supply_chain']}>
                <CompliancePage />
              </RequireRole>
            } />

            <Route path="/government" element={
              <RequireRole roles={['government']}>
                <GovernmentPage />
              </RequireRole>
            } />

            <Route path="/manufacturer" element={
              <RequireRole roles={['manufacturer']}>
                <ManufacturerPage />
              </RequireRole>
            } />

            <Route path="/distributor" element={
              <RequireRole roles={['distributor']}>
                <DistributorPage />
              </RequireRole>
            } />

            <Route path="/supply-chain" element={
              <RequireRole roles={['supply_chain']}>
                <SupplyChainPage />
              </RequireRole>
            } />

            <Route path="/nurse" element={
              <RequireRole roles={['nurse', 'supply_chain']}>
                <NursePage />
              </RequireRole>
            } />

            <Route path="/infection-prevention" element={
              <RequireRole roles={['infection_prevention', 'government']}>
                <InfectionPrevPage />
              </RequireRole>
            } />

            <Route path="/bulk-import" element={
              <RequireRole roles={['admin','supply_chain']}>
                <BulkImportPage />
              </RequireRole>
            } />

            <Route path="/surgeon" element={
              <RequireRole roles={['surgeon']}>
                <SurgeonPage />
              </RequireRole>
            } />

            <Route path="/admin" element={
              <RequireRole roles={['admin']}>
                <AdminPage />
              </RequireRole>
            } />
          </Route>

          <Route path="/verify" element={<VerificationPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
