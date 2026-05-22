import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout, RequireRole } from './components/Layout';
import LoginPage             from './pages/LoginPage';
import DashboardPage         from './pages/DashboardPage';
import GovernmentPage        from './pages/GovernmentPage';
import ManufacturerPage      from './pages/ManufacturerPage';
import DistributorPage       from './pages/DistributorPage';
import DentistPage           from './pages/DentistPage';
import DentalAssistantPage   from './pages/DentalAssistantPage';
import InfectionControlPage  from './pages/InfectionControlPage';
import AdminPage             from './pages/AdminPage';
import CasesPage             from './pages/CasesPage';
import LabWorkPage           from './pages/LabWorkPage';
import FollowUpPage          from './pages/FollowUpPage';
import AnalyticsPage         from './pages/AnalyticsPage';
import OnboardingPage        from './pages/OnboardingPage';
import AuditPage             from './pages/AuditPage';
import CompliancePage        from './pages/CompliancePage';
import HistoryPage           from './pages/HistoryPage';
import VerificationPage      from './pages/VerificationPage';

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
            <Route path="/history"   element={<HistoryPage />} />

            {/* Dental Cases */}
            <Route path="/cases" element={
              <RequireRole roles={['dentist','dental_assistant','admin']}>
                <CasesPage />
              </RequireRole>
            } />

            {/* Lab Work */}
            <Route path="/lab-work" element={
              <RequireRole roles={['dentist','dental_assistant','admin']}>
                <LabWorkPage />
              </RequireRole>
            } />

            {/* Follow-ups */}
            <Route path="/follow-ups" element={
              <RequireRole roles={['dentist','dental_assistant','infection_control','admin']}>
                <FollowUpPage />
              </RequireRole>
            } />

            {/* Admin */}
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
            <Route path="/audit" element={
              <RequireRole roles={['admin','government']}>
                <AuditPage />
              </RequireRole>
            } />
            <Route path="/compliance" element={
              <RequireRole roles={['government','infection_control','admin']}>
                <CompliancePage />
              </RequireRole>
            } />

            {/* Role portals */}
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
            <Route path="/dentist" element={
              <RequireRole roles={['dentist']}>
                <DentistPage />
              </RequireRole>
            } />
            <Route path="/dental-assistant" element={
              <RequireRole roles={['dental_assistant','dentist']}>
                <DentalAssistantPage />
              </RequireRole>
            } />
            <Route path="/infection-control" element={
              <RequireRole roles={['infection_control','government']}>
                <InfectionControlPage />
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
