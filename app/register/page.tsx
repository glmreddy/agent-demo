import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RegisterForm from "@/components/RegisterForm";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/profile");
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="auth-subtitle">
          Save your travel preferences and get a weekly digest tailored to you.
        </p>
        <RegisterForm />
        <p className="auth-switch">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </main>
  );
}
