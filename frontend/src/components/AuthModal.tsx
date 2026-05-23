import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";

/** Must match schemes/user.py (UserCreate) */
const USERNAME_MIN_LENGTH = 5;
const USERNAME_MAX_LENGTH = 19;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 64;

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    username: z
      .string()
      .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
      .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data.username, data.password);
      setShowAuthModal(false);
      loginForm.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setError(null);
    try {
      await register(data.username, data.password);
      setShowAuthModal(false);
      registerForm.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    loginForm.reset();
    registerForm.reset();
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isLogin ? "Welcome back" : "Create an account"}
          </DialogTitle>
          <DialogDescription>
            {isLogin
              ? "Sign in to your account to continue"
              : "Enter your details to create your account"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLogin ? (
          <form
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                type="text"
                placeholder="Your username"
                {...loginForm.register("username")}
              />
              {loginForm.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {loginForm.formState.errors.username.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginForm.formState.isSubmitting}
            >
              {loginForm.formState.isSubmitting ? (
                <>
                  <Spinner /> Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={registerForm.handleSubmit(handleRegister)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-username">Username</Label>
              <Input
                id="register-username"
                type="text"
                placeholder={`Username (${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters)`}
                minLength={USERNAME_MIN_LENGTH}
                maxLength={USERNAME_MAX_LENGTH}
                {...registerForm.register("username")}
              />
              {registerForm.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {registerForm.formState.errors.username.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                {...registerForm.register("password")}
              />
              <p className="text-xs text-muted-foreground">
                Minimum {PASSWORD_MIN_LENGTH} characters.
              </p>
              {registerForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="register-confirm">Confirm Password</Label>
              <Input
                id="register-confirm"
                type="password"
                placeholder="Confirm your password"
                {...registerForm.register("confirmPassword")}
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {registerForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={registerForm.formState.isSubmitting}
            >
              {registerForm.formState.isSubmitting ? (
                <>
                  <Spinner /> Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        )}

        <div className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={toggleMode}
            className="font-medium text-primary hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
