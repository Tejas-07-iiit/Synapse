"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, BarChart2, Zap, Shield, ChevronRight } from 'lucide-react';

export function AuthBranding() {
  return (
    <div className="relative z-10 flex flex-col justify-between h-full p-10 lg:p-16 text-foreground">
      <div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center space-x-3 mb-16"
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            <Zap className="w-6 h-6 text-primary-foreground" fill="currentColor" />
          </div>
          <span className="text-2xl font-black tracking-tight text-foreground">SYNAPSE</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-primary/80">
            Institutional Grade <br />
            Trading Workspace
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mb-12 leading-relaxed font-medium">
            AI-powered trading intelligence, real-time market analytics, and lightning-fast execution for the modern trader.
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="relative"
      >
        {/* Mockup UI Panel */}
        <div className="w-full max-w-lg rounded-2xl bg-card border border-border/50 backdrop-blur-md p-6 overflow-hidden shadow-2xl shadow-primary/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2 text-sm text-primary font-bold uppercase tracking-wider">
              <Activity className="w-4 h-4" />
              <span>AI Signal Active</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">Live Uplink</span>
          </div>

          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors cursor-default group">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${i === 1 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : i === 2 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'}`}>
                    {i === 1 ? <BarChart2 className="w-4 h-4" /> : i === 2 ? <Zap className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{i === 1 ? 'BTC/USD Long' : i === 2 ? 'Momentum Spike' : 'Risk Hedged'}</div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight">{i === 1 ? 'Confidence 94%' : i === 2 ? 'ETH Volume +300%' : 'Auto-balanced'}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
            ))}
          </div>
        </div>
        
        {/* Decorative elements behind the card */}
        <div className="absolute -z-10 top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-[80px] dark:bg-blue-600/30" />
        <div className="absolute -z-10 -bottom-10 -left-10 w-40 h-40 bg-cyan-600/10 rounded-full blur-[80px] dark:bg-cyan-600/30" />
      </motion.div>
    </div>
  );
}
