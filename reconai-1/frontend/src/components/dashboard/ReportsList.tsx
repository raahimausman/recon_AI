'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchUserRuns,
  deleteRun,
} from '@/lib/firebaseRuns';
import ReportItem from './ReportItem';

export default function ReportsList() {
  const user = useAuth();
  const [runs, setRuns] = useState<
    Awaited<ReturnType<typeof fetchUserRuns>>
  >([]);

  /* initial + real-time refresh (polling every 60 s) */
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const data = await fetchUserRuns(user);
      if (isMounted) setRuns(data);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { isMounted = false; clearInterval(id); };
  }, [user]);

  /* download helper (same for all rows) */
  const handleDownload = async (url: string, name: string) => {
  // ① fetch the asset from Cloudinary
  const res = await fetch(url);
  if (!res.ok) {
    alert('Unable to download report');
    return;
  }

  // ② turn it into a Blob, tell the browser it’s a PDF
  const blob = await res.blob();
  const pdfBlob =
    blob.type === 'application/pdf' ? blob : blob.slice(0, blob.size, 'application/pdf');

  // ③ create a temporary object-URL and trigger the download
  const tmpUrl = URL.createObjectURL(pdfBlob);
  const fileName = name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;

  const a = document.createElement('a');
  a.href = tmpUrl;
  a.download = fileName;
  a.click();

  // ④ tidy up
  URL.revokeObjectURL(tmpUrl);
};

  /* delete helper */
  const handleDelete = async (runId: string) => {
    if (!confirm('Delete this report permanently?')) return;
    await deleteRun(user, runId);
    setRuns(runs.filter(r => r.id !== runId));
  };

  return (
    <section className="w-full mt-10">
      <h2 className="text-2xl font-bold mb-6">Reports</h2>
      <ul>
        {runs.map(r => (
          <ReportItem
            key={r.id}
            filename={r.filename}
            url={r.pdfUrl}
            completedAt={r.completedAt}
            onDownload={() => handleDownload(r.pdfUrl, r.filename)}
            onDelete  ={() => handleDelete(r.id)}
          />
        ))}
        {runs.length === 0 && (
          <p className="text-gray-600">No finished runs yet.</p>
        )}
      </ul>
    </section>
  );
}