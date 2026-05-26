"use client";

import React from 'react';
import { motion } from 'framer-motion';

export function AuthBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-background dark:bg-[#09090b] z-0 transition-colors duration-500">
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-20 transition-opacity duration-500"
        style={{
          backgroundImage: `linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Glowing Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 dark:bg-blue-600/20 blur-[120px]"
      />
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.05, 0.1, 0.05],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute top-[40%] -right-[20%] w-[60%] h-[60%] rounded-full bg-cyan-600/10 dark:bg-cyan-600/20 blur-[120px]"
      />
      
      {/* Dark overlay for text readability (only in dark mode) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#09090b]/80 via-transparent to-[#09090b]/80 z-0 hidden dark:block" />
      
      {/* Light mode gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent z-0 dark:hidden" />
    </div>
  );
}
