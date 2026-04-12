"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithEmailPassword, loginWithGoogle } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, router, user]);

  const onSubmit = async (values: LoginForm) => {
    setLoading(true);
    try {
      await loginWithEmailPassword(values.email, values.password);
      toast.success("Logged in successfully");
      router.replace("/dashboard");
    } catch {
      toast.error("Login failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success("Logged in with Google");
      router.replace("/dashboard");
    } catch {
      toast.error("Google login failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4">
      <Card className="w-full max-w-md rounded-2xl border-white/50 bg-white/90 shadow-xl shadow-sky-100 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to manage your PLI sections and annexures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@company.com" {...register("email")} />
              {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
              {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 size-4" />
              {loading ? "Signing in..." : "Login"}
            </Button>
          </form>

          <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={googleLoading}>
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
