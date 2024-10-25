import cors from "cors";
import express from "express";
import { registerCallRouter } from "./router/call";
import { registerHomeRouter } from "./router/home";
export async function createServer(): Promise<express.Application> {
    const app = express();
    app.use(cors());
    app.use(
        express.json({
            limit: "15mb",
        }),
    );

    await registerHomeRouter(app);
    await registerCallRouter(app);
    return app;
}
