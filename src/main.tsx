import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { AuthProvider, useAuth } from "@/platform/auth/AuthProvider";
import { LoginPage, SetupNeeded } from "@/platform/auth/LoginPage";
import { supabaseConfigured } from "@/platform/data/supabase";
import { AppShell } from "@/platform/ui/AppShell";
import { HOME_PATH, modules } from "@/modules/registry";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function App() {
  const { session, loading } = useAuth();
  if (!supabaseConfigured) return <SetupNeeded />;
  if (loading) return <div className="min-h-screen" />;
  if (!session) return <LoginPage />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={HOME_PATH} replace />} />
        {modules.map((m) => (
          <Route key={m.path} path={m.path} element={m.element} />
        ))}
        <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
