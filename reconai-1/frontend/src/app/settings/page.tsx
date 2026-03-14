"use client";

import BackButton from "@/components/BackButton";
import { useAuthGuard } from "../../lib/useAuthGuard";

export default function SettingsPage() {
  useAuthGuard();

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-100">
      <div className="absolute top-4 left-8">
        <BackButton />
      </div>
        <h1 className="text-2xl font-semibold">Settings Page</h1>
    </div>
  );
}