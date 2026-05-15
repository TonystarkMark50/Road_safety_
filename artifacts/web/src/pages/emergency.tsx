import { useState } from "react";
import { useListEmergencyServices, useTriggerSOS, getListEmergencyServicesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Phone, MapPin, Navigation, Shield, Ambulance, Building2, Flame } from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  hospital: Building2,
  police: Shield,
  fire: Flame,
  ambulance: Ambulance,
};

const typeColors: Record<string, string> = {
  hospital: "text-blue-400 bg-blue-500/10",
  police: "text-indigo-400 bg-indigo-500/10",
  fire: "text-orange-400 bg-orange-500/10",
  ambulance: "text-red-400 bg-red-500/10",
};

export default function Emergency() {
  const [type, setType] = useState("all");
  const [sosActive, setSosActive] = useState(false);
  const [sosResponse, setSosResponse] = useState<any>(null);
  const triggerSOS = useTriggerSOS();

  const params = { type: type !== "all" ? type as any : undefined, lat: 28.6315, lng: 77.2167 };
  const { data: services, isLoading } = useListEmergencyServices({
    params,
    options: { queryKey: getListEmergencyServicesQueryKey(params) },
  });

  function handleSOS() {
    if (sosActive) return;
    setSosActive(true);
    triggerSOS.mutate(
      { data: { latitude: 28.6315, longitude: 77.2167, description: "Emergency SOS triggered via RoadSoS AI" } },
      {
        onSuccess: (res) => {
          setSosResponse(res);
          setTimeout(() => setSosActive(false), 10000);
        },
        onError: () => setSosActive(false),
      }
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Emergency Response</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Nearest emergency services and one-tap SOS</p>
      </div>

      {/* SOS Button */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 mb-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">In case of emergency, press the SOS button to alert nearby services</p>
        <button
          data-testid="button-sos"
          onClick={handleSOS}
          disabled={sosActive || triggerSOS.isPending}
          className={`w-32 h-32 rounded-full font-bold text-lg border-4 transition-all duration-300 mx-auto flex items-center justify-center flex-col gap-1 ${
            sosActive
              ? "bg-red-500/30 border-red-500/50 text-red-300 animate-pulse cursor-not-allowed"
              : "bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30 hover:scale-105 active:scale-95 cursor-pointer"
          }`}
        >
          <AlertCircle className="w-8 h-8" />
          <span>SOS</span>
        </button>
        {sosResponse && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            {sosResponse.message}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Emergency Numbers: Police 100 | Fire 101 | Ambulance 102 | Disaster 108
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Nearby Emergency Services</h2>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36" data-testid="select-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "hospital", "police", "fire", "ambulance"].map((t) => (
              <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Services List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {services?.map((s) => {
            const Icon = typeIcons[s.type] ?? Shield;
            return (
              <div data-testid={`card-service-${s.id}`} key={s.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[s.type] ?? "text-primary bg-primary/10"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-sm">{s.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.isAvailable ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {s.isAvailable ? "Available" : "Busy"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{s.address}
                    </p>
                    {s.distanceKm != null && (
                      <p className="text-xs text-primary mt-0.5">{s.distanceKm} km away</p>
                    )}
                  </div>
                  <a href={`tel:${s.phone}`} className="shrink-0">
                    <Button size="sm" className="gap-1.5" data-testid={`button-call-${s.id}`}>
                      <Phone className="w-3.5 h-3.5" />
                      {s.phone}
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
          {!services?.length && (
            <div className="p-8 text-center text-muted-foreground text-sm rounded-xl border border-border bg-card">
              No services found nearby
            </div>
          )}
        </div>
      )}
    </div>
  );
}
