// lib/authentication.ts

import { auth, db } from './firebase';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  GoogleAuthProvider,
} from 'firebase/auth';

/**
 * Sign up user using Firebase Auth and create Firestore user profile
 * @param email - user email
 * @param password - user password
 * @param fullName - full name for profile
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  fullName: string
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase Auth display name
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: fullName,
      });
    }

    // Create Firestore user document
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      fullName,
      email,
      profileImage: '', // Optional default values
    });

    return { user };
  } // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (error: any) {
    console.error('Error during sign-up:', error);
    throw new Error(error.message);
  }
};

/**
 * Login user with email and password
 * @param email - user email
 * @param password - user password
 */
export const loginWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
  } // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message);
  }
};


/**
 * Sign in using Google account and ensure Firestore profile exists
 */
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user profile already exists
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Create profile if not found
      await setDoc(userRef, {
        uid: user.uid,
        fullName: user.displayName || '',
        email: user.email,
        profileImage: user.photoURL || '',
      });
    }

    return { user };
  } // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (error: any) {
    console.error('Google sign-in error:', error);
    throw new Error(error.message);
  }
};

/**
 * Logout current user
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch (error: any) {
    console.error('Logout error:', error);
    throw new Error(error.message);
  }
};