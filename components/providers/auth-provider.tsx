"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserDocument, getUserById } from "@/lib/firestore";
import { AppUser, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  appUser: AppUser | null;
  role: UserRole;
  loading: boolean;
  isSuperAdmin: boolean;
  canComment: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  appUser: null,
  role: "viewer",
  loading: true,
  isSuperAdmin: false,
  canComment: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser?.email) {
        try {
          const existingProfile = await getUserById(firebaseUser.uid);

          if (!existingProfile) {
            await ensureUserDocument({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              role: "viewer",
            });
          }

          const profile = existingProfile ?? (await getUserById(firebaseUser.uid));
          setAppUser(profile);
        } catch (error) {
          console.error("Failed to sync user document:", error);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      appUser,
      role: appUser?.role ?? "viewer",
      loading,
      isSuperAdmin: appUser?.role === "superadmin",
      canComment: appUser?.role === "superadmin" || appUser?.role === "analyst",
    }),
    [user, appUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
