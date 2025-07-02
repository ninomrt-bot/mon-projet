// pages/_app.jsx
import "../styles/globals.css";
import { useState, useEffect } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { UserCircle } from "lucide-react";
import useLowStockCount from "../lib/useLowStockCount";

function Header() {
  const { data: session } = useSession();
  const router            = useRouter();
  const alertCount        = useLowStockCount();
  const isLoginPage       = router.pathname === "/login";
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const avatarSrc = session?.user?.image || null;
  const userName  = session?.user?.name  || "";

  return (
    <header className="flex items-center justify-between bg-gray-100 p-4 shadow">
      {/* Logo */}
      <Link href="/">
        <img
          src="/logo_stirweld.png"
          alt="Logo Stirweld"
          className="h-20 w-auto cursor-pointer"
        />
      </Link>

      {/* Menu (caché sur /login) */}
      {!isLoginPage && (
        <nav className="flex items-center gap-6">
          <Link href="/stock" className="text-gray-700 hover:text-gray-900">
            Stock
          </Link>
          <Link href="/commandes" className="text-gray-700 hover:text-gray-900">
            Commandes
          </Link>
          <div className="relative">
            <Link href="/alertes" className="text-gray-700 hover:text-gray-900">
              Alertes
            </Link>
            {alertCount > 0 && (
              <span
                className="
                  absolute -top-3 -right-3
                  h-5 min-w-[20px] px-1
                  bg-red-600 text-white text-xs font-semibold
                  rounded-full flex items-center justify-center
                "
              >
                {alertCount}
              </span>
            )}
          </div>
          <Link href="/history" className="text-gray-700 hover:text-gray-900">
            Historique
          </Link>
          <Link href="/projects" className="text-gray-700 hover:text-gray-900">
            Produits
          </Link>
          <Link href="/projects-asana" className="text-gray-700 hover:text-gray-900">
            Asana
          </Link>

          {/* Profil / Déconnexion */}
          {session?.user ? (
            <div className="flex flex-col items-center gap-1 relative">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={userName}
                  onClick={() => setShowLogoutConfirm(true)}
                  className="h-10 w-10 rounded-full object-cover cursor-pointer border-2 border-gray-300"
                />
              ) : (
                <UserCircle
                  className="h-10 w-10 text-gray-400 cursor-pointer"
                  onClick={() => setShowLogoutConfirm(true)}
                />
              )}
              <span className="text-gray-800 font-medium text-sm">
                {userName}
              </span>
            </div>
          ) : (
            <Link href="/login" className="text-blue-600 hover:underline">
              Connexion
            </Link>
          )}
        </nav>
      )}

      {/* Popup de confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-xs text-center">
            <p className="mb-4">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="flex justify-around">
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  signOut({ callbackUrl: "http://192.168.128.79:3000/login" });
                }}
                className="px-4 py-1 bg-red-600 text-white rounded"
              >
                Oui
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-1 bg-gray-300 rounded"
              >
                Non
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return (
    <SessionProvider session={session}>
      <Header />
      <main className="p-4">
        <Component {...pageProps} />
      </main>
    </SessionProvider>
  );
}
