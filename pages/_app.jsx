// pages/_app.jsx
import { useState } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import Link from "next/link";
import "../styles/globals.css";

function Header() {
  const { data: session } = useSession();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Normalise le nom d'utilisateur pour retrouver le fichier image
  const usernameKey = session?.user?.name?.replace(/\s+/g, "") || null;
  const avatarSrc   = usernameKey
    ? `/photo_user/${usernameKey}.jpg`
    : null;

  const openConfirm = () => setShowLogoutConfirm(true);
  const closeConfirm = () => setShowLogoutConfirm(false);
  const handleLogout = () => {
    setShowLogoutConfirm(false);
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="flex items-center justify-between bg-gray-100 p-4 shadow">
      {/* Logo */}
      <div>
        <Link href="/">
          <img
            src="/logo_stirweld.png"
            alt="Logo Stirweld"
            className="h-12 w-auto cursor-pointer"
          />
        </Link>
      </div>

      {/* Nav & User */}
      <nav className="flex items-center gap-6">
        <Link href="/stock"     className="text-gray-700 hover:text-gray-900">Stock</Link>
        <Link href="/commandes" className="text-gray-700 hover:text-gray-900">Commandes</Link>
        <Link href="/alertes"   className="text-gray-700 hover:text-gray-900">Alertes</Link>
        <Link href="/history"   className="text-gray-700 hover:text-gray-900">Historique</Link>
        <Link href="/projects"  className="text-gray-700 hover:text-gray-900">Projets</Link>

        {session?.user ? (
          <div className="flex flex-col items-center gap-1 relative">
            {avatarSrc && (
              <img
                src={avatarSrc}
                alt={session.user.name}
                onClick={openConfirm}
                className="h-10 w-10 rounded-full object-cover cursor-pointer border-2 border-gray-300"
              />
            )}
            <span className="text-gray-800 font-medium text-sm">
              {session.user.name}
            </span>

            {/* Modal de confirmation */}
            {showLogoutConfirm && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded shadow-lg max-w-xs text-center">
                  <p className="mb-4">Voulez-vous vraiment vous déconnecter&nbsp;?</p>
                  <div className="flex justify-around">
                    <button
                      onClick={handleLogout}
                      className="px-4 py-1 bg-red-600 text-white rounded"
                    >
                      Oui
                    </button>
                    <button
                      onClick={closeConfirm}
                      className="px-4 py-1 bg-gray-300 rounded"
                    >
                      Non
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="text-blue-600 hover:underline">
            Connexion
          </Link>
        )}
      </nav>
    </header>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Header />
      <main className="p-4">
        <Component {...pageProps} />
      </main>
    </SessionProvider>
  );
}
