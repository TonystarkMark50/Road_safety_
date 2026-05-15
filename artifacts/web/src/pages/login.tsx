import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Shield, AlertCircle } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const { setAuth } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const loginMutation = useLogin();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: FormData) {
    setError(null);
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          setAuth(res.token);
          setLocation("/dashboard");
        },
        onError: () => {
          setError("Invalid email or password. Try admin@roadsosai.com / password123");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-sidebar p-10 border-r border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white font-[family-name:var(--font-serif)]">RoadSoS AI</span>
        </div>
        <div>
          <blockquote className="text-lg text-sidebar-foreground/80 leading-relaxed mb-4">
            "RoadSoS AI helped us resolve 200+ road hazard reports in our district in just one month. The analytics dashboard is remarkable."
          </blockquote>
          <div className="text-sm text-sidebar-foreground/50">
            <div className="font-medium text-sidebar-foreground/80">Executive Engineer</div>
            <div>PWD Delhi, South Zone</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { v: "50K+", l: "Reports Resolved" },
            { v: "89%", l: "Resolution Rate" },
            { v: "120+", l: "Cities" },
            { v: "2.3hr", l: "Avg Response" },
          ].map((s) => (
            <div key={s.l} className="p-3 rounded-lg bg-sidebar-accent">
              <div className="text-lg font-bold text-primary">{s.v}</div>
              <div className="text-xs text-sidebar-foreground/60">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold font-[family-name:var(--font-serif)]">RoadSoS AI</span>
          </div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)] mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive mb-5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input data-testid="input-email" type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input data-testid="input-password" type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-submit"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Demo: <span className="text-foreground font-mono text-xs">admin@roadsosai.com / password123</span>
          </div>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
