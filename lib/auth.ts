import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
} from "firebase/auth";
import { FirebaseError, initializeApp } from "firebase/app";
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
    await tempApp.delete();
  }
};
