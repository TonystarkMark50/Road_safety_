import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, Map, BarChart3, ChevronRight, Zap, Globe, Users, FileText } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg font-[family-name:var(--font-serif)]">RoadSoS AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="link-login">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" data-testid="link-register">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
            <Zap className="w-3 h-3" />
            AI-Powered Civic Safety Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 font-[family-name:var(--font-serif)] leading-[1.05]">
            Report Roads.<br />
            <span className="text-primary">Save Lives.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            RoadSoS AI connects citizens, emergency responders, and government authorities through intelligent road safety reporting, real-time emergency response, and public infrastructure transparency.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 px-8 h-12" data-testid="button-get-started">
                Start Reporting
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="gap-2 px-8 h-12" data-testid="button-view-demo">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 py-12 px-6 bg-card/30">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "50K+", label: "Reports Filed" },
            { value: "89%", label: "Resolution Rate" },
            { value: "2.3 hrs", label: "Avg Response Time" },
            { value: "120+", label: "Cities Covered" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-primary font-[family-name:var(--font-serif)]">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold font-[family-name:var(--font-serif)] mb-3">Everything your city needs</h2>
            <p className="text-muted-foreground">One platform for citizens, responders, and government</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: FileText,
                title: "Smart Reporting",
                desc: "File road hazard reports with GPS location, photos, and automatic ticket tracking",
                color: "text-blue-400",
                bg: "bg-blue-500/10",
              },
              {
                icon: AlertCircle,
                title: "Emergency SOS",
                desc: "One-tap SOS with instant connection to nearest hospitals, police, and ambulances",
                color: "text-red-400",
                bg: "bg-red-500/10",
              },
              {
                icon: Map,
                title: "Live Heatmaps",
                desc: "Visualize accident hotspots, road quality scores, and issue density across your city",
                color: "text-green-400",
                bg: "bg-green-500/10",
              },
              {
                icon: BarChart3,
                title: "Public Transparency",
                desc: "Track government budgets, contractor performance, and road maintenance timelines",
                color: "text-amber-400",
                bg: "bg-amber-500/10",
              },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-200 group">
                <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-16 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold font-[family-name:var(--font-serif)] text-center mb-10">Built for everyone</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: "Citizens",
                items: ["File road hazard reports", "Track complaint status", "Upvote community issues", "Access emergency SOS"],
              },
              {
                icon: Shield,
                title: "Admin & Authority",
                items: ["Monitor all reports", "Assign and resolve complaints", "View analytics dashboards", "Manage budget transparency"],
              },
              {
                icon: Globe,
                title: "Emergency Services",
                items: ["Receive SOS alerts", "Navigate to emergencies", "Coordinate with hospitals", "Access real-time road data"],
              },
            ].map((role) => (
              <div key={role.title} className="p-6 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <role.icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{role.title}</h3>
                </div>
                <ul className="space-y-2">
                  {role.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border/50 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold font-[family-name:var(--font-serif)] mb-4">Make your city safer today</h2>
          <p className="text-muted-foreground mb-8">Join thousands of citizens using RoadSoS AI to report road hazards and save lives</p>
          <Link href="/register">
            <Button size="lg" className="gap-2 px-10 h-12" data-testid="button-join">
              Join RoadSoS AI
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 px-6 text-center text-sm text-muted-foreground">
        <p>RoadSoS AI — Smart Road Safety Ecosystem | Built for India and beyond</p>
      </footer>
    </div>
  );
}
