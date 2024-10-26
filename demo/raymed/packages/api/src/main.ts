import fastifyFormBody from "@fastify/formbody";
import fastifyMiddie from "@fastify/middie";
import fastifyWs from "@fastify/websocket";
import cors from "cors";
import Fastify from "fastify";
import mqttRoutes from "./routes/mqtt";
import patientRoutes from "./routes/patient";
export const server = Fastify({});

await server.register(fastifyWs);
await server.register(fastifyFormBody);
await server.register(patientRoutes);
await server.register(fastifyMiddie);
await server.register(mqttRoutes);
server.use(cors());

const start = async () => {
    try {
        await server.listen({ port: 1994 });
        console.log(`Server is listening on port 1994`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
