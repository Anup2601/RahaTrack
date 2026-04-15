import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateEmail,
  updatePassword,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
} from "firebase/auth";
import { deleteApp, FirebaseError, initializeApp } from "firebase/app";
import { auth, firebaseConfig } from "@/lib/firebase";
import { ensureUserDocument } from "@/lib/firestore";
import { UserRole } from "@/lib/types";

export const loginWithEmailPassword = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  return signOut(auth);
};

export const createUserBySuperadmin = async (payload: {
  email: string;
  password: string;
  role: UserRole;
}) => {
  const tempAppName = `superadmin-create-${Date.now()}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);

  try {
    const secondaryAuth = getAuth(tempApp);
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      payload.email,
      payload.password,
    );

    await ensureUserDocument({
      id: credential.user.uid,
      email: payload.email,
      role: payload.role,
    });

    await signOut(secondaryAuth);

    return credential.user;
  } catch (error) {
    if (error instanceof FirebaseError) {
      throw new Error(error.code);
    }

    throw error;
  } finally {
    await deleteApp(tempApp);
  }
};

export const updateUserCredentialsBySuperadmin = async (payload: {
  currentEmail: string;
  currentPassword: string;
  newEmail?: string;
  newPassword?: string;
}) => {
  const tempAppName = `superadmin-update-${Date.now()}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);

  try {
    const secondaryAuth = getAuth(tempApp);
    const credential = await signInWithEmailAndPassword(
      secondaryAuth,
      payload.currentEmail,
      payload.currentPassword,
    );

    if (payload.newEmail && payload.newEmail !== payload.currentEmail) {
      await updateEmail(credential.user, payload.newEmail);
    }

    if (payload.newPassword) {
      await updatePassword(credential.user, payload.newPassword);
    }

    await signOut(secondaryAuth);
  } catch (error) {
    if (error instanceof FirebaseError) {
      throw new Error(error.code);
    }

    throw error;
  } finally {
    await deleteApp(tempApp);
  }
};

export const deleteUserBySuperadmin = async (payload: { email: string; password: string }) => {
  const tempAppName = `superadmin-delete-${Date.now()}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);

  try {
    const secondaryAuth = getAuth(tempApp);
    const credential = await signInWithEmailAndPassword(
      secondaryAuth,
      payload.email,
      payload.password,
    );

    await deleteUser(credential.user);
    await signOut(secondaryAuth);
  } catch (error) {
    if (error instanceof FirebaseError) {
      throw new Error(error.code);
    }

    throw error;
  } finally {
    await deleteApp(tempApp);
  }
};
