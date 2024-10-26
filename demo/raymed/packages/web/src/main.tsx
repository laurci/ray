import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./routes/Register.tsx";

import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Layout from "./Layout.tsx";
import Home from "./routes/Home.tsx";
import Patient from "./routes/Patient.tsx";

// const router = createBrowserRouter([
//     {
//         path: "/",
//         element: <Home />,
//     },
//     {
//         path: "/register",
//         element: <App />,
//     },
//     {
//         path: "/patient/:id",
//         element: <Patient />,
//         loader: async ({ params }) => {
//             // const response = await fetch(`${import.meta.env.VITE_API_URL}/patient/${params.id}`);
//             // const data = await response.json();

//             // return data;
//             return params.id;
//         },
//     },
// ]);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        {/* <RouterProvider router={router} /> */}

        <Router>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="/register" element={<App />} />
                    <Route
                        path="/patient/:id"
                        element={<Patient />}
                        loader={async ({ params }) => params.id}
                    />
                </Route>
            </Routes>
        </Router>
    </StrictMode>,
);
