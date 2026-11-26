import { NavLink, Outlet } from "react-router-dom";
import { modules } from "@/modules/registry";
import { signOut, useAuth } from "@/platform/auth/AuthProvider";

export function AppShell() {
  const { session } = useAuth();
  const groups = [...new Set(modules.map((m) => m.group))];

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-stone-700 bg-navy-900/60 md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <span className="font-semibold tracking-tight text-stone-100">Career Hub</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-5 md:pb-0">
          {groups.map((group) => (
            <div key={group} className="flex gap-1 md:flex-col">
              <p className="eyebrow hidden px-2 pb-1 md:block">{group}</p>
              {modules
                .filter((m) => m.group === group)
                .map((m) => (
                  <NavLink
                    key={m.path}
                    to={m.path}
                    className={({ isActive }) =>
                      `flex items-center justify-between whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ${
                        isActive
                          ? "bg-navy-800 text-stone-100 shadow-[inset_2px_0_0_var(--color-brass-300)]"
                          : "text-stone-400 hover:bg-navy-800/60 hover:text-stone-200"
                      }`
                    }
                  >
                    {m.label}
                    {m.status === "soon" && <span className="ml-2 text-[10px] uppercase tracking-wider text-stone-500">soon</span>}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="hidden px-5 py-6 md:block">
          <p className="truncate text-xs text-stone-500">{session?.user.email}</p>
          <button onClick={signOut} className="mt-1 cursor-pointer text-xs text-stone-400 hover:text-stone-200">
            Sign out
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-10 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
