import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Landing from "@/pages/landing";
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

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#4ba8f7",
    colorForeground: "#f0f4f8",
    colorMutedForeground: "#7a8499",
    colorDanger: "#ef4444",
    colorBackground: "#0f1728",
    colorInput: "#131d2e",
    colorInputForeground: "#f0f4f8",
    colorNeutral: "#161e32",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0f1728] border border-[#161e32] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#f0f4f8] font-semibold",
    headerSubtitle: "text-[#7a8499]",
    socialButtonsBlockButtonText: "text-[#f0f4f8]",
    formFieldLabel: "text-[#f0f4f8]",
    footerActionLink: "text-[#4ba8f7]",
    footerActionText: "text-[#7a8499]",
    dividerText: "text-[#7a8499]",
    identityPreviewEditButton: "text-[#4ba8f7]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[#f0f4f8]",
    logoBox: "mb-2",
    logoImage: "h-12 w-12",
    socialButtonsBlockButton: "border-[#161e32] hover:bg-[#131d2e]",
    formButtonPrimary: "bg-[#4ba8f7] hover:bg-[#3a97e6] text-white",
    formFieldInput: "bg-[#131d2e] border-[#161e32] text-[#f0f4f8]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#161e32]",
    alert: "bg-[#131d2e] border-[#161e32]",
    otpCodeFieldInput: "bg-[#131d2e] border-[#161e32] text-[#f0f4f8]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({
  component: Component,
  roles,
}: {
  component: React.ComponentType;
  roles?: string[];
}) {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user, isLoading } = useAuth();

  if (!isLoaded || isLoading) return <LoadingSpinner />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!user) return <LoadingSpinner />;
  if (roles && !roles.includes(user.role)) return <Redirect to="/dashboard" />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  if (!isLoaded) return <LoadingSpinner />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your RoadSoS AI account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join RoadSoS AI and report road hazards",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AuthProvider>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/login" component={() => <Redirect to="/sign-in" />} />
              <Route path="/register" component={() => <Redirect to="/sign-up" />} />
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
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
