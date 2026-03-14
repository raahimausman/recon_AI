// lib/firebaseRuns.ts
import {
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  doc,
  getDocs,
  query,
  where,
  deleteDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { AuthUser } from '@/context/AuthContext';

export type RunStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface NewRunPayload {
  mode: string;                     // e.g. "INV_SUM"
  runLabel?: string;
}

export interface PatchRunPayload {
  status?: RunStatus;
  stats?: Record<string, number>;
  outputUrls?: Record<string, string | string[]>;
  insightMd?: string;
  errorMsg?: string;
  markCompleted?: boolean;          // convenience flag
}

/**
 * Add NEW doc → returns runId (or null for guests)
 */
export async function addReconciliationDoc(
  user: AuthUser | null,
  { mode, runLabel }: NewRunPayload,
): Promise<string | null> {
  if (!user) return null;                           // guest → skip

  const ref = await addDoc(collection(db, 'reconciliations'), {
    userId: user.uid,
    mode,
    runLabel: runLabel ?? '',
    status: 'queued',
    startedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Patch an existing run.  Silently no-ops for guests / missing runId.
 */
export async function updateRun(
  user: AuthUser | null,
  runId: string | null,
  patch: PatchRunPayload,
) {
  if (!user || !runId) return;                      // guest → skip

  const updates: Record<string, any> = { ...patch };

  // set completedAt atomically on success / error
  if (patch.markCompleted) {
    updates.completedAt = serverTimestamp();
    delete updates.markCompleted;
  }

  await updateDoc(doc(db, 'reconciliations', runId), updates);
}

/* ——————————————————————————————————————— */
/* ① fetch ALL runs for one user (new)           */
export async function fetchUserRuns(
  user: AuthUser | null,
): Promise<Array<{
  id: string;
  filename: string;              // prettified name
  completedAt: Date;
  pdfUrl: string;                 // Cloudinary link
  status: RunStatus;
}>> {
  if (!user) return [];

  const q = query(
    collection(db, 'reconciliations'),
    where('userId', '==', user.uid),
  );

  const snap = await getDocs(q);
  return snap.docs.flatMap(d => {
    const data = d.data() as any;
    if (!data.outputUrls?.pdf) return [];          // skip “processing” runs
    return [{
      id         : d.id,
      filename   : data.outputUrls.pdf.split('/').pop() ?? 'report.pdf',
      completedAt: data.completedAt?.toDate?.() ?? new Date(),
      pdfUrl     : data.outputUrls.pdf,
      status     : data.status as RunStatus,
    }];
  });
}

/* ——————————————————————————————————————— */
/* ② delete one run + its doc (new)              */
export async function deleteRun(
  user: AuthUser | null,
  runId: string,
) {
  if (!user) return;
  await deleteDoc(doc(db, 'reconciliations', runId));
}

export async function fetchRunsForUser(uid: string): Promise<[]> {
  const q = query(
    collection(db, 'reconciliations'),
    where('userId', '==', uid),
    orderBy('startedAt', 'asc'),          // uses Index #1
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as [];
}
