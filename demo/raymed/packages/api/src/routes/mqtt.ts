import awsIot from "aws-iot-device-sdk";
import { FastifyInstance, RouteShorthandOptions } from "fastify";
import callRoute from "./call";

function removePostalCode(address: string) {
    const parts = address.split(",");
    const cleanedParts = parts.map((part) => {
        return part
            .trim()
            .replace(/\b\d{6}\b/, "")
            .trim();
    });
    return cleanedParts.filter((part) => part).join(", ");
}

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
        device.subscribe("raymed", undefined, (error: Error | undefined) => {
            if (error) {
                console.error("Subscription error", error);
            } else {
                console.log("Subscribed to raymed");
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

    interface Message {
        message: string;
        patientId: string;
        geoLocation: {
            lat: number;
            long: number;
        };
        incidentType: string;
    }

    device.on("message", async (topic, message: Message) => {
        const messageJson = JSON.parse(message.toString());

        const geoLocation = messageJson.geoLocation;
        const addressUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${geoLocation.lat},${geoLocation.long}&sensor=false&key=${process.env.GOOGLE_MAPS_API_KEY!}`;
        const address: string = await fetch(addressUrl).then((res) =>
            res.json().then((data) => {
                if (data.results.length) {
                    if (data.results[0].formatted_address) {
                        return data.results[0].formatted_address;
                    } else return "";
                } else return "";
            }),
        );

        const incidentLocation = removePostalCode(address);
        const incidentType = messageJson.incidentType;

        if (messageJson.message === "incident_call") {
            const response = await fastify.inject({
                method: "POST",
                url: `/call/${messageJson.patientId}`,
                payload: { incidentLocation, incidentType },
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }
        console.log(`Received message on topic ${topic}: ${message.toString()}`);
    });

    //Route for testing MQTT
    fastify.get<{ Params: { id: string } }>("/mqtt/:id", async (request, reply) => {
        const { id } = request.params;
        try {
            device.publish(
                "raymed",
                JSON.stringify({
                    message: "incident_call",
                    patientId: id,
                    geoLocation: { lat: 47.048013, long: 21.92426 },
                    incidentType: "heart_attack",
                }),
                undefined,
                (error: Error | undefined) => {
                    if (error) {
                        console.error("Publish error", error);
                        reply.code(500).send({ message: "Failed to publish" });
                    } else {
                        console.log("Message published to raymed");
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
