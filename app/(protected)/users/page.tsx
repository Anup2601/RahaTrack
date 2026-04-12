"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createUserBySuperadmin } from "@/lib/auth";
import { subscribeUsers } from "@/lib/firestore";
import { AppUser, UserRole } from "@/lib/types";

const roles: UserRole[] = ["superadmin", "analyst", "viewer"];

const getAuthErrorMessage = (message: string) => {
  if (message.includes("auth/email-already-in-use")) {
    return "This email is already registered.";
  }

  if (message.includes("auth/invalid-email")) {
    return "Enter a valid email address.";
  }

  if (message.includes("auth/weak-password")) {
    return "Password must be at least 6 characters.";
  }

  return "Unable to create user.";
};

export default function UsersPage() {
  const router = useRouter();
  const { isSuperAdmin, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeUsers(
      (items) => {
        setUsers(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Unable to load users");
      },
    );

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleCreateUser = async () => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can create users");
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required");
      return;
    }

    setSubmitting(true);

    try {
      await createUserBySuperadmin({
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      toast.success("User created successfully");
      setEmail("");
      setPassword("");
      setRole("viewer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(getAuthErrorMessage(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <p className="text-sm text-muted-foreground">Checking permissions...</p>;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="user@company.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button onClick={handleCreateUser} disabled={submitting}>
            {submitting ? "Creating..." : "Add User"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-14 text-center text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.email}</TableCell>
                        <TableCell className="capitalize">{item.role}</TableCell>
                        <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
