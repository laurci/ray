import { NavLink, Outlet } from "react-router-dom";
import "./App.css";
function Layout() {
    return (
        <div className="flex min-h-screen w-full flex-col items-center">
            <header className="flex w-full items-end">
                <nav className="flex w-full flex-row items-end justify-end">
                    <ul className="flex flex-row gap-8">
                        <li>
                            <NavLink
                                className={({ isActive, isPending }) =>
                                    isPending
                                        ? "pending"
                                        : isActive
                                          ? "text-green-500 underline"
                                          : ""
                                }
                                to="/"
                            >
                                Home
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                className={({ isActive, isPending }) =>
                                    isPending
                                        ? "pending"
                                        : isActive
                                          ? "text-green-500 underline"
                                          : ""
                                }
                                to="/register"
                            >
                                Register
                            </NavLink>
                        </li>
                    </ul>
                </nav>
            </header>
            <main className="flex flex-col items-center">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;
