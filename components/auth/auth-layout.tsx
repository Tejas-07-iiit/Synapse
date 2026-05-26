import React from 'react';
import { AuthBackground } from './auth-background';
import { AuthBranding } from './auth-branding';
import { ThemeToggle } from '@/components/theme/theme-toggle';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex bg-background selection:bg-primary/30 font-sans transition-colors duration-500">
      {/* Left side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex relative w-1/2 flex-col overflow-hidden border-r border-border/10">
        <AuthBackground />
        <AuthBranding />
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden z-20">
        {/* Decorative background for the form side in light mode */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 opacity-50 dark:opacity-0 pointer-events-none" />
        
        {/* Mobile background (faint version for mobile only) */}
        <div className="absolute inset-0 lg:hidden pointer-events-none z-[-1]">
          <AuthBackground />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
        </div>
        
        {/* Theme Toggle in Auth Pages */}
        <div className="absolute top-8 right-8 z-50">
          <ThemeToggle />
        </div>

        {/* The form card wrapper */}
        <div className="w-full max-w-md relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
