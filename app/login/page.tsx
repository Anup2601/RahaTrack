"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackButton } from "@/components/common/back-button";
import { loginWithEmailPassword } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { auth } from "@/lib/firebase";
import { getUserById } from "@/lib/firestore";
import { signOut } from "firebase/auth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
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
      const credential = await loginWithEmailPassword(values.email, values.password);
      const profile = await getUserById(credential.user.uid);

      if (profile?.status === "disabled") {
        await signOut(auth);
        toast.error("Your account is disabled. Please contact superadmin.");
        return;
      }

      toast.success("Logged in successfully");
      router.replace("/dashboard");
    } catch {
      toast.error("Login failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <Image
            src="/rahalogo.png"
            alt="Raha logo"
            width={162}
            height={162}
            className="h-24 w-24 object-contain"
            priority
          />
        </div>

        <Card className="rounded-2xl border-white/50 bg-white/90 shadow-xl shadow-sky-100 backdrop-blur">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-3xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to manage your account</CardDescription>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
