import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import CalendarPage from "./pages/CalendarPage";
import CompaniesPage from "./pages/CompaniesPage";
import DashboardPage from "./pages/DashboardPage";
import InternshipsPage from "./pages/InternshipsPage";
import LoginPage from "./pages/LoginPage";
import SelectionsPage from "./pages/SelectionsPage";
import SettingsPage from "./pages/SettingsPage";
import SignupPage from "./pages/SignupPage";
import { useAuth } from "./store/auth";
import { ReactNode } from "react";

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const hydrated = useAuth((s) => s.hydrated);
  // Wait for IndexedDB hydration before redirecting to /login so we don't
  // flash the login page on iOS Safari PWA when localStorage was cleared but
  // IDB still has the token.
  if (!token && !hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        読み込み中...
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="internships" element={<InternshipsPage />} />
            <Route path="selections" element={<SelectionsPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
