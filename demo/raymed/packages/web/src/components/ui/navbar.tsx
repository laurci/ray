import { NavLink } from "react-router-dom";

const links = [
    {
        to: "/",
        label: "Home",
    },
    {
        to: "/register",
        label: "Register",
    },
    {
        to: "/patients",
        label: "Patients",
    },
];
export const Navbar = () => {
    return (
        <nav>
            {links.map((link) => (
                <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive, isPending }) =>
                        isPending ? "pending" : isActive ? "active" : ""
                    }
                >
                    {link.label}
                </NavLink>
            ))}
        </nav>
    );
};
