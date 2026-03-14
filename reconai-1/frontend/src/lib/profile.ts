import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Fetch current user's profile
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetchUserProfile = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // prevent memory leak
      if (!user) return reject(new Error('User not authenticated'));

      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error('User profile not found');

        resolve(docSnap.data());
      } catch (err) {
        reject(err);
      }
    });
  });
};

// Update current user's profile
export const updateUserProfile = async (updatedData: {
  fullName?: string;
  email?: string;
  profileImage?: string;
}) => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const docRef = doc(db, 'users', user.uid);

  // First-time users: use `setDoc` instead of `updateDoc`
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    await setDoc(docRef, {
      uid: user.uid,
      email: user.email,
      ...updatedData,
    });
  } else {
    await updateDoc(docRef, updatedData);
  }
};
