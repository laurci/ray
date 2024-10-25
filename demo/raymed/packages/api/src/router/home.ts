import type { Application } from "express";

export async function registerHomeRouter(app: Application) {
    app.get("/", (req, res) => {
        res.send("Hello World!");
    });
}
