"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  LayoutDashboard, 
  User as UserIcon, 
  Settings, 
  LogOut, 
  Mail, 
  Calendar, 
  Shield 
} from "lucide-react";

export default function DashboardView() {
  const router = useRouter();
  const { user, logout, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // If auth state is resolved and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  // Fallback if user is null (though middleware/useEffect guards it)
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-full shrink-0">
        <div className="p-6 border-b border-slate-800">
          <span className="text-xl font-bold tracking-wider text-blue-400">SYNAPSE</span>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 bg-blue-600 text-white rounded font-medium transition"
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded transition"
          >
            <Shield size={20} />
            <span>Security</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded transition"
          >
            <Settings size={20} />
            <span>Settings</span>
          </a>
        </nav>

        {/* Bottom logout section */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-slate-800 hover:text-red-300 rounded transition"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">System Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
              {user.username}
            </span>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-8 space-y-8">
          {/* Welcome Message */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800">
              Welcome back, <span className="text-blue-600">{user.username}</span>!
            </h2>
            <p className="text-gray-500 mt-2">
              Here is your account overview. All core modules are operational and connected.
            </p>
          </div>

          {/* Stats Placeholder Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                System Status
              </h3>
              <p className="text-2xl font-bold text-green-600 mt-2">Operational</p>
              <span className="text-xs text-gray-400 mt-1 block">Authentication Connected</span>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Database Provider
              </h3>
              <p className="text-2xl font-bold text-gray-800 mt-2">PostgreSQL</p>
              <span className="text-xs text-gray-400 mt-1 block">Connected via Prisma ORM</span>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Session Active
              </h3>
              <p className="text-2xl font-bold text-blue-600 mt-2">Yes</p>
              <span className="text-xs text-gray-400 mt-1 block">HTTP-Only Cookie secured</span>
            </div>
          </div>

          {/* User Information Details Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">User Account Information</h3>
            </div>
            <div className="p-6 divide-y divide-gray-100">
              <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-gray-500">Account ID</span>
                <span className="text-sm font-mono text-gray-800 mt-1 sm:mt-0">{user.id}</span>
              </div>
              <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <UserIcon size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Username</span>
                </div>
                <span className="text-sm text-gray-800 mt-1 sm:mt-0">{user.username}</span>
              </div>
              <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Email Address</span>
                </div>
                <span className="text-sm text-gray-800 mt-1 sm:mt-0">{user.email}</span>
              </div>
              <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Member Since</span>
                </div>
                <span className="text-sm text-gray-800 mt-1 sm:mt-0">
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
