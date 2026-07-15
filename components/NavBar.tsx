import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function NavBar() {
  const user = await getSessionUser();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          Wanderlust Travel
        </Link>
        <div className="navbar-links">
          {user ? (
            <>
              <Link href="/profile" className="nav-link">
                Profile
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">
                Log in
              </Link>
              <Link href="/register" className="nav-link nav-link--cta">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
