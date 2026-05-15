import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  under_review: { label: "Under Review", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  assigned: { label: "Assigned", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  in_progress: { label: "In Progress", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  resolved: { label: "Resolved", className: "bg-green-500/15 text-green-400 border-green-500/30" },
};

const severityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  medium: { label: "Medium", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  high: { label: "High", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  critical: { label: "Critical", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const categoryLabels: Record<string, string> = {
  pothole: "Pothole",
  road_damage: "Road Damage",
  accident: "Accident",
  waterlogging: "Waterlogging",
  signal_failure: "Signal Failure",
  illegal_parking: "Illegal Parking",
  congestion: "Congestion",
  other: "Other",
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: "bg-gray-500/15 text-gray-400 border-gray-500/30" };
  return <Badge className={`text-xs border ${config.className}`}>{config.label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity] ?? { label: severity, className: "bg-gray-500/15 text-gray-400 border-gray-500/30" };
  return <Badge className={`text-xs border ${config.className}`}>{config.label}</Badge>;
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge className="text-xs border bg-primary/10 text-primary border-primary/20">
      {categoryLabels[category] ?? category}
    </Badge>
  );
}
