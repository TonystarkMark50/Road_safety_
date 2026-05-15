import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useLocation } from "wouter";
import { useCreateReport, getListReportsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, MapPin, Loader2 } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  category: z.enum(["pothole", "road_damage", "accident", "waterlogging", "signal_failure", "illegal_parking", "congestion", "other"]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  address: z.string().min(5, "Address is required"),
  latitude: z.string().transform((v) => parseFloat(v)),
  longitude: z.string().transform((v) => parseFloat(v)),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

type FormData = z.infer<typeof schema>;

const categories = [
  { value: "pothole", label: "Pothole" },
  { value: "road_damage", label: "Road Damage" },
  { value: "accident", label: "Accident / Hazard" },
  { value: "waterlogging", label: "Waterlogging" },
  { value: "signal_failure", label: "Signal Failure" },
  { value: "illegal_parking", label: "Illegal Parking" },
  { value: "congestion", label: "Traffic Congestion" },
  { value: "other", label: "Other" },
];

const severities = [
  { value: "low", label: "Low — Minor inconvenience" },
  { value: "medium", label: "Medium — Affects traffic flow" },
  { value: "high", label: "High — Danger to road users" },
  { value: "critical", label: "Critical — Immediate action needed" },
];

export default function NewReport() {
  const [, setLocation] = useLocation();
  const [success, setSuccess] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const queryClient = useQueryClient();
  const createReport = useCreateReport();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      category: "pothole" as any,
      description: "",
      address: "",
      latitude: "28.6315" as any,
      longitude: "77.2167" as any,
      severity: "medium" as any,
    },
  });

  function detectLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        form.setValue("latitude", String(pos.coords.latitude) as any);
        form.setValue("longitude", String(pos.coords.longitude) as any);
      });
    }
  }

  function onSubmit(data: FormData) {
    createReport.mutate(
      { data: { ...data, latitude: Number(data.latitude), longitude: Number(data.longitude) } },
      {
        onSuccess: (res) => {
          setTicketId(res.ticketId);
          setSuccess(true);
          queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        },
      }
    );
  }

  if (success) {
    return (
      <div className="p-6 max-w-md mx-auto flex flex-col items-center justify-center min-h-64 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-serif)] mb-2">Report Filed!</h2>
        <p className="text-sm text-muted-foreground mb-2">Your report has been submitted successfully.</p>
        <p className="text-xs font-mono bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20 mb-6">
          Ticket ID: {ticketId}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setSuccess(false); form.reset(); }}>File Another</Button>
          <Button onClick={() => setLocation("/reports")}>View Reports</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">File a Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Report a road issue to the concerned authorities</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input data-testid="input-title" placeholder="e.g. Large pothole on main road near bus stop" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-severity">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {severities.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      data-testid="input-description"
                      placeholder="Describe the issue in detail — size, duration, impact on traffic..."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address / Location</FormLabel>
                  <FormControl>
                    <Input data-testid="input-address" placeholder="e.g. Connaught Place, New Delhi, near Gate 5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input data-testid="input-latitude" placeholder="28.6315" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input data-testid="input-longitude" placeholder="77.2167" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={detectLocation}
              data-testid="button-detect-location"
            >
              <MapPin className="w-4 h-4" />
              Auto-detect Location
            </Button>

            <Button type="submit" className="w-full" disabled={createReport.isPending} data-testid="button-submit">
              {createReport.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : "Submit Report"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
