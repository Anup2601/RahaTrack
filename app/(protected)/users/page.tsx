"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { TableColumnFilter, type ColumnFilterOption } from "@/components/common/table-column-filter";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createUserBySuperadmin,
  deleteUserBySuperadmin,
  updateUserCredentialsBySuperadmin,
} from "@/lib/auth";
import { deleteUserProfile, subscribeUsers, updateUserProfile, updateUserStatus } from "@/lib/firestore";
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
  const { user, isSuperAdmin, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("viewer");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editCurrentPassword, setEditCurrentPassword] = useState("");
  const [deleteUserItem, setDeleteUserItem] = useState<AppUser | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [tableFilters, setTableFilters] = useState({
    email: null as string[] | null,
    role: null as string[] | null,
    status: null as string[] | null,
    created: null as string[] | null,
  });

  const createdLabel = (item: AppUser) => (item.createdAt ? new Date(item.createdAt).toLocaleString() : "-");

  const filterOptions = useMemo(() => {
    const buildOptions = (values: string[]): ColumnFilterOption[] => {
      const counts = values.reduce<Record<string, number>>((acc, value) => {
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    };

    return {
      email: buildOptions(users.map((item) => item.email)),
      role: buildOptions(users.map((item) => item.role)),
      status: buildOptions(users.map((item) => item.status ?? "active")),
      created: buildOptions(users.map((item) => createdLabel(item))),
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((item) => {
      if (tableFilters.email && !tableFilters.email.includes(item.email)) {
        return false;
      }

      if (tableFilters.role && !tableFilters.role.includes(item.role)) {
        return false;
      }

      const userStatus = item.status ?? "active";
      if (tableFilters.status && !tableFilters.status.includes(userStatus)) {
        return false;
      }

      if (tableFilters.created && !tableFilters.created.includes(createdLabel(item))) {
        return false;
      }

      return true;
    });
  }, [tableFilters, users]);

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

  const getUserActionErrorMessage = (message: string) => {
    if (message.includes("auth/wrong-password") || message.includes("auth/invalid-credential")) {
      return "Current password is incorrect.";
    }

    if (message.includes("auth/email-already-in-use")) {
      return "This email is already in use.";
    }

    if (message.includes("auth/weak-password")) {
      return "New password must be at least 6 characters.";
    }

    if (message.includes("auth/invalid-email")) {
      return "Enter a valid email address.";
    }

    return "User action failed. Please try again.";
  };

  const openEditUser = (item: AppUser) => {
    setEditingUser(item);
    setEditEmail(item.email);
    setEditRole(item.role);
    setEditNewPassword("");
    setEditCurrentPassword("");
    setEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) {
      return;
    }

    const normalizedEmail = editEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Email is required");
      return;
    }

    const needsCredentialUpdate =
      normalizedEmail !== editingUser.email.toLowerCase() || editNewPassword.trim().length > 0;

    if (needsCredentialUpdate && !editCurrentPassword.trim()) {
      toast.error("Current password is required to change email or password");
      return;
    }

    setRowActionLoadingId(editingUser.id);
    try {
      if (needsCredentialUpdate) {
        await updateUserCredentialsBySuperadmin({
          currentEmail: editingUser.email,
          currentPassword: editCurrentPassword,
          newEmail: normalizedEmail !== editingUser.email.toLowerCase() ? normalizedEmail : undefined,
          newPassword: editNewPassword.trim() || undefined,
        });
      }

      await updateUserProfile(editingUser.id, {
        email: normalizedEmail,
        role: editRole,
      });

      toast.success("User updated");
      setEditOpen(false);
      setEditingUser(null);
      setEditCurrentPassword("");
      setEditNewPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(getUserActionErrorMessage(message));
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleToggleUserStatus = async (item: AppUser) => {
    if (item.id === user?.uid) {
      toast.error("You cannot disable your own account");
      return;
    }

    const nextStatus = (item.status ?? "active") === "disabled" ? "active" : "disabled";
    setRowActionLoadingId(item.id);

    try {
      await updateUserStatus(item.id, nextStatus);
      toast.success(nextStatus === "disabled" ? "User disabled" : "User enabled");
    } catch {
      toast.error("Failed to update user status");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const openDeleteUser = (item: AppUser) => {
    if (item.id === user?.uid) {
      toast.error("You cannot delete your own account");
      return;
    }

    setDeleteUserItem(item);
    setDeletePassword("");
    setDeleteOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserItem) {
      return;
    }

    if (!deletePassword.trim()) {
      toast.error("Current password is required to delete this user");
      return;
    }

    setRowActionLoadingId(deleteUserItem.id);
    try {
      await deleteUserBySuperadmin({
        email: deleteUserItem.email,
        password: deletePassword,
      });

      await deleteUserProfile(deleteUserItem.id);
      toast.success("User deleted");
      setDeleteOpen(false);
      setDeleteUserItem(null);
      setDeletePassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(getUserActionErrorMessage(message));
    } finally {
      setRowActionLoadingId(null);
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
                <TableHeader className="bg-[#8a8a8a]">
                  <TableRow>
                    <TableHead >
                      <div className="flex items-center justify-between gap-2">
                        <span>Email</span>
                        <TableColumnFilter
                          title="Email"
                          options={filterOptions.email}
                          selectedValues={tableFilters.email}
                          onApply={(values) =>
                            setTableFilters((previous) => ({ ...previous, email: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Role</span>
                        <TableColumnFilter
                          title="Role"
                          options={filterOptions.role}
                          selectedValues={tableFilters.role}
                          onApply={(values) =>
                            setTableFilters((previous) => ({ ...previous, role: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Created</span>
                        <TableColumnFilter
                          title="Created"
                          options={filterOptions.created}
                          selectedValues={tableFilters.created}
                          onApply={(values) =>
                            setTableFilters((previous) => ({ ...previous, created: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Status</span>
                        <TableColumnFilter
                          title="Status"
                          options={filterOptions.status}
                          selectedValues={tableFilters.status}
                          onApply={(values) =>
                            setTableFilters((previous) => ({ ...previous, status: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-14 text-center text-muted-foreground">
                        No users found for selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.email}</TableCell>
                        <TableCell className="capitalize">{item.role}</TableCell>
                        <TableCell>{createdLabel(item)}</TableCell>
                        <TableCell className="capitalize">{item.status ?? "active"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Update"
                              aria-label={`Update ${item.email}`}
                              onClick={() => openEditUser(item)}
                              disabled={rowActionLoadingId === item.id}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title={(item.status ?? "active") === "disabled" ? "Enable" : "Disable"}
                              aria-label={`${(item.status ?? "active") === "disabled" ? "Enable" : "Disable"} ${item.email}`}
                              onClick={() => handleToggleUserStatus(item)}
                              disabled={rowActionLoadingId === item.id}
                            >
                              <UserX className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Delete"
                              aria-label={`Delete ${item.email}`}
                              onClick={() => openDeleteUser(item)}
                              disabled={rowActionLoadingId === item.id}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) {
            setEditingUser(null);
            setEditCurrentPassword("");
            setEditNewPassword("");
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={editEmail}
              onChange={(event) => setEditEmail(event.target.value)}
            />
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={editRole}
              onChange={(event) => setEditRole(event.target.value as UserRole)}
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Input
              type="password"
              placeholder="New password (optional)"
              value={editNewPassword}
              onChange={(event) => setEditNewPassword(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Current password (required for email/password change)"
              value={editCurrentPassword}
              onChange={(event) => setEditCurrentPassword(event.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleUpdateUser}
              disabled={!editingUser || rowActionLoadingId === editingUser.id}
            >
              {editingUser && rowActionLoadingId === editingUser.id ? "Updating..." : "Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (!next) {
            setDeleteUserItem(null);
            setDeletePassword("");
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the auth account and user profile for {deleteUserItem?.email}.
            </p>
            <Input
              type="password"
              placeholder="Current password of this user"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={!deleteUserItem || rowActionLoadingId === deleteUserItem.id}
            >
              {deleteUserItem && rowActionLoadingId === deleteUserItem.id ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
