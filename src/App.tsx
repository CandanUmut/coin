import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SendPage } from '@/pages/SendPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { FeedPage } from '@/pages/FeedPage';
import { MarketplacePage } from '@/pages/MarketplacePage';
import { CreateTaskPage } from '@/pages/CreateTaskPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { CreateServicePage } from '@/pages/CreateServicePage';
import { ServiceDetailPage } from '@/pages/ServiceDetailPage';
import { SearchPage } from '@/pages/SearchPage';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <HashRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/send" element={<SendPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/tasks/new" element={<CreateTaskPage />} />
          <Route path="/marketplace/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/marketplace/services/new" element={<CreateServicePage />} />
          <Route path="/marketplace/services/:id" element={<ServiceDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
