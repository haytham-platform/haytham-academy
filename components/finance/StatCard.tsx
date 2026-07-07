import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/finance-labels";

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  variant?: "primary" | "danger" | "success" | "neutral";
}

const variants = {
  primary: "text-primary",
  danger: "text-red-600",
  success: "text-green-600",
  neutral: "text-foreground",
};

export default function StatCard({
  title,
  value,
  subtitle,
  variant = "neutral",
}: StatCardProps) {
  return (
    <Card className="!p-4">
      <p className="text-sm text-muted">{title}</p>
      <p className={cn("mt-1 text-2xl font-bold", variants[variant])}>
        {formatCurrency(value)}
      </p>
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
    </Card>
  );
}
