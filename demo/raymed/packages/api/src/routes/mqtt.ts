import awsIot from "aws-iot-device-sdk";
import { FastifyInstance, RouteShorthandOptions } from "fastify";
import callRoute from "./call";
async function mqttRoutes(fastify: FastifyInstance, options: RouteShorthandOptions) {
    const device = new awsIot.device({
        keyPath: process.env.AWS_KEY_PATH!,
        certPath: process.env.AWS_CERT_PATH!,
        caPath: process.env.AWS_CA_PATH!,
        host: process.env.AWS_IOT_HOST!,
        clientId: process.env.AWS_IOT_CLIENT_ID!,
        region: "eu-central-1",
        keepalive: 20,
        reconnectPeriod: 1000,
    });

    device.on("connect", () => {
        console.log("Connected to MQTT broker");
        device.subscribe("test_topic", undefined, (error: Error | undefined) => {
            if (error) {
                console.error("Subscription error", error);
            } else {
                console.log("Subscribed to test_topic");
            }
        });
    });

    device.on("error", (error) => {
        console.log("MQTT error", error);
    });

    device.on("error", (error) => {
        console.error("MQTT connection error:", error);
    });

    device.on("close", () => {
        console.log("MQTT connection closed");
    });

    device.on("offline", () => {
        console.log("MQTT connection offline");
    });

    device.on("reconnect", () => {
        console.log("Attempting to reconnect to MQTT broker");
    });

    fastify.register(callRoute);

    device.on("message", async (topic, message) => {
        const messageJson = JSON.parse(message.toString());

        console.log("messageJson", messageJson);
        if (messageJson.message === "incident_call") {
            const response = await fastify.inject({
                method: "GET",
                url: `/call/${messageJson.patientId}`,
            });

            console.log("response", await response.json());
        }
        console.log(`Received message on topic ${topic}: ${message.toString()}`);
    });

    fastify.get<{ Params: { id: string } }>("/mqtt/:id", async (request, reply) => {
        const { id } = request.params;
        try {
            console.log("will publish to test_topic");
            device.publish(
                "test_topic",
                JSON.stringify({ message: "incident_call", patientId: id }),
                undefined,
                (error: Error | undefined) => {
                    if (error) {
                        console.error("Publish error", error);
                        reply.code(500).send({ message: "Failed to publish" });
                    } else {
                        console.log("Message published to test_topic");
                        reply.send({ message: "Message published to MQTT" });
                    }
                },
            );
        } catch (err) {
            console.error("MQTT route error", err);
            reply.code(500).send({ message: "MQTT route failed" });
        }

        return reply.send({ message: "Message published to MQTT" });
    });
}

export default mqttRoutes;
