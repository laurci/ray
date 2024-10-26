import awsIot from "aws-iot-device-sdk";
import { FastifyInstance, RouteShorthandOptions } from "fastify";

const device = new awsIot.device({
    keyPath: "/Users/alexandrujonnyserban/Downloads/connect_device_package/device-demo.private.key",
    certPath: "/Users/alexandrujonnyserban/Downloads/connect_device_package/device-demo.cert.pem",
    caPath: "/Users/alexandrujonnyserban/Downloads/AmazonRootCA1.pem",
    host: "a2i4c37vbdbkyv-ats.iot.eu-central-1.amazonaws.com",
    clientId: "iotconsole-51131fcb-840c-41a0-ae5d-40907d14e4b6",
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

device.on("message", (topic, message) => {
    console.log(`Received message on topic ${topic}: ${message.toString()}`);
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

async function mqttRoutes(fastify: FastifyInstance, options: RouteShorthandOptions) {
    fastify.get("/mqtt", async (request, reply) => {
        try {
            console.log("will publish to test_topic");
            device.publish("test_topic", "sent from NODEJS", {}, (error: Error | undefined) => {
                if (error) {
                    console.error("Publish error", error);
                    reply.code(500).send({ message: "Failed to publish" });
                } else {
                    console.log("Message published to test_topic");
                    reply.send({ message: "Message published to MQTT" });
                }
            });
        } catch (err) {
            console.error("MQTT route error", err);
            reply.code(500).send({ message: "MQTT route failed" });
        }

        return reply.send({ message: "Message published to MQTT" });
    });
}

export default mqttRoutes;
