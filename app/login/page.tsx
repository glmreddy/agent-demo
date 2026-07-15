import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/profile");
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Sign in to manage your travel preferences.</p>
        <LoginForm />
        <p className="auth-switch">
          Don't have an account? <a href="/register">Create one</a>
        </p>
      </div>
    </main>
  );
}
