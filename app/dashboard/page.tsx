import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata: Metadata = {
  title: "Trading Workspace - Synapse",
  description: "Real-time cryptocurrency trading workspace powered by Binance WebSockets and technical indicators.",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
