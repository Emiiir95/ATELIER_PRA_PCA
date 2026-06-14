import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, GraduationCap, Users, FileUp, Images, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/",        label: "Dashboard",      icon: LayoutDashboard },
  { to: "/classes", label: "Classes",         icon: GraduationCap   },
  { to: "/students",label: "Élèves",          icon: Users           },
  { to: "/import",  label: "Import CSV",      icon: FileUp          },
  { to: "/trombi",  label: "Trombinoscope",   icon: Images          },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-60 bg-indigo-900 text-white flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-indigo-700">
          <h1 className="text-xl font-bold tracking-tight">Trombinoscope</h1>
        </div>

        <nav className="flex-1 py-4">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-700 text-white"
                    : "text-indigo-200 hover:bg-indigo-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-5 py-4 border-t border-indigo-700 flex flex-col gap-3">
          <div>
            <p className="text-xs text-indigo-300 truncate">{user?.email}</p>
            <span
              className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                isAdmin
                  ? "bg-amber-400 text-amber-900"
                  : "bg-indigo-400 text-indigo-900"
              }`}
            >
              {isAdmin ? "Admin" : "Enseignant"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-indigo-300 hover:text-white text-xs transition-colors"
          >
            <LogOut size={14} />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
