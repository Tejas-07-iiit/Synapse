"use client";

import React, { useState, useEffect } from "react";
import { useMcxStore } from "@/store/useMcxStore";
import { motion } from "framer-motion";
import { Coins, Settings, TrendingUp, RefreshCw } from "lucide-react";
import McxPriceChart from "@/components/mcx/McxPriceChart";
import MCXLoader from "@/components/mcx/MCXLoader";

export default function McxChartsPage() {
  const { selectedCommodity } = useMcxStore();
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mcx/chart/${selectedCommodity}`);
      const data = await res.json();
      if (data && data.success && data.data) {
        setChartData(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch chart data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [selectedCommodity]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
            {selectedCommodity} Advanced Charts
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dedicated trading view interface with technical analysis overlays.
          </p>
        </div>
        <button
          onClick={fetchChartData}
          className="p-2.5 bg-muted/40 hover:bg-muted/80 border border-border rounded-xl transition-all"
          title="Reload Chart Data"
        >
          <RefreshCw size={15} className="text-orange-500" />
        </button>
      </div>

      {/* Large dedicated chart frame */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm min-h-[550px] flex flex-col relative overflow-hidden">
        <div className="flex-1 w-full relative h-[500px] bg-muted/10 border border-border/30 rounded-xl overflow-hidden">
          {loading ? (
            <MCXLoader fullscreen={false} message={`Loading advanced charts for ${selectedCommodity}...`} />
          ) : chartData.length > 0 ? (
            <McxPriceChart data={chartData} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              No chart data available for {selectedCommodity}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
