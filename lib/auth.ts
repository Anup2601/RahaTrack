import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

export const loginWithEmailPassword = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const loginWithGoogle = async () => {
  return signInWithPopup(auth, googleProvider);
};

export const logoutUser = async () => {
  return signOut(auth);
};

export const getIsAdmin = (user: User | null) => {
  if (!user?.email) {
    return false;
  }

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    return true;
  }

  return adminEmails.includes(user.email.toLowerCase());
};
