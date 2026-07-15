import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="profile-page">
      <div className="profile-header">
        <h1>Your profile</h1>
        <p className="profile-hint">Signed in as {user.email}</p>
      </div>
      <ProfileForm
        initial={{
          name: user.name,
          email: user.email,
          digestOptIn: user.digestOptIn,
          profile: user.profile,
        }}
      />
    </main>
  );
}
