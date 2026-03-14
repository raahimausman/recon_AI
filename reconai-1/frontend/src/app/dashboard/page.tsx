"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import BackButton from "@/components/BackButton";
import { useAuthGuard } from "../../lib/useAuthGuard";
import DropdownUser from "@/components/dashboard-header/DropdownUser";
import ReportsList from '@/components/dashboard/ReportsList';
import { Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchRunsForUser } from '@/lib/firebaseRuns';
import RunsPerWeek from '@/components/charts/RunsPerWeek';
import { format } from 'date-fns';


export default function DashboardPage() {
  useAuthGuard();

    const user = useAuth();
    const [runs, setRuns] = useState([]);

    useEffect(() => {
      if (!user) return;
      fetchRunsForUser(user.uid).then(setRuns);
    }, [user]);

    /* --- build chart datasets --- */
    const weekly = runs.reduce<Record<string, number>>((acc: any, r: any) => {
      const key = format(r.startedAt.toDate(), 'yyyy-ww');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const weeklyData = Object.entries(weekly).map(([week, count]) => ({ week, count }));

    const issuesData = runs.map((r: any, i: number) => ({
      run   : `#${i + 1}`,
      issues: r.stats?.issues ?? 0,
    }));

    console.log(weeklyData, issuesData);

  return (
    <div className="flex flex-col min-h-screen bg-white px-12 pb-12">
      
      {/* Back Button + Profile Row */}
      <div className="flex justify-between items-center w-full">
        <div className="mb-6">
          <BackButton />
        </div>
        <DropdownUser />
      </div>

      {/* Add New Reconciliation Run Button + Header */}
      <div className="flex items-center justify-between my-8">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold mb-2">Reconciliation Dashboard</h1>
          <p>Easily monitor and manage your invoice reconciliation process.</p>
        </div>
        <Link href="/reconciliation-mode" className="flex items-center">
          <Image
          src="/assets/add-vector.png"
          alt="Add New Reconciliation Run"
          width={40}
          height={40}
          />
          <p className="font-semibold text-black ml-4">Add New</p>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 my-8">
      <section className="border p-4 rounded-md shadow">
        <h2 className="font-semibold mb-2">Runs per week</h2>
        <RunsPerWeek data={weeklyData}/>
      </section>
    </div>
      
      {/* User Reports */}
      <div className="flex justify-start">
        <Suspense fallback={<p>Loading reports…</p>}>
          <ReportsList/>
        </Suspense>
      </div>
    </div>
  );
}