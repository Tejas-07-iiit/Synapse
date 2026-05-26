import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Login - Synapse",
  description: "Log in to your Synapse account to access the dashboard and tools.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <LoginForm />
    </main>
  );
}
