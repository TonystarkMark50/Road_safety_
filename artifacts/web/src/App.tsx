import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Reports from "@/pages/reports";
import ReportDetail from "@/pages/report-detail";
import NewReport from "@/pages/new-report";
import MyReports from "@/pages/my-reports";
import Emergency from "@/pages/emergency";
import MapView from "@/pages/map";
import Transparency from "@/pages/transparency";
import Budget from "@/pages/budget";
import Admin from "@/pages/admin";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { user, isLoading, token } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!token || !user) {
    return <Redirect to="/login" />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, token, isLoading } = useAuth();
  if (isLoading) return null;
  if (token && user) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => {
        const { user, token } = useAuth();
        if (token && user) return <Redirect to="/dashboard" />;
        return <Landing />;
      }} />
      <Route path="/login" component={() => <PublicRoute component={Login} />} />
      <Route path="/register" component={() => <PublicRoute component={Register} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/reports/new" component={() => <ProtectedRoute component={NewReport} />} />
      <Route path="/reports/:id" component={() => <ProtectedRoute component={ReportDetail} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/my-reports" component={() => <ProtectedRoute component={MyReports} roles={["citizen"]} />} />
      <Route path="/emergency" component={() => <ProtectedRoute component={Emergency} />} />
      <Route path="/map" component={() => <ProtectedRoute component={MapView} />} />
      <Route path="/transparency" component={() => <ProtectedRoute component={Transparency} />} />
      <Route path="/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={Admin} roles={["admin", "authority"]} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={() => <Redirect to="/" />} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
