import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import Fastify from "fastify";
import WebSocket from "ws";

export const fastify = Fastify({});

const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
    console.error(
        "Please provide TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in the environment variables",
    );
    process.exit(1);
}

const client = require("twilio")(accountSid, authToken);

const SYSTEM_MESSAGE =
    "You are an AI that calls on behalf of a human that just had a medical emergency. You have to tell the emergency services what happened and where you are (the person had a seizure and fainted). The person's name is Jonny and he's a 30 years old guy with a medical history of epilepsy. He's currently unconscious and needs immediate medical attention";
// const SHOW_TIMING_MATH = false;

await fastify.register(fastifyWs);
await fastify.register(fastifyFormBody);

fastify.get("/", async (request, reply) => {
    reply.send({ message: "Twilio Media Stream Server is running!" });
});

fastify.all("/call", async (req, res) => {
    console.log("Initiating call... from /call");
    try {
        console.log("Initiating call...");
        const call = await client.calls.create({
            url: `https://9e6660e69843.ngrok.app/twiml`,
            to: "+40757378264", // destination number
            from: process.env.TWILIO_PHONE_NUMBER,
        });
        console.log("Call initiated");
        res.send({ message: "Call initiated", callSid: call.sid });
    } catch (error) {
        console.error("Error making call:", error);
        res.status(500).send({ error: "Failed to initiate call" });
    }
});

fastify.post("/twiml", (req, res) => {
    console.log("Received TwiML request");
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>Please wait while we connect your call to the A. I. voice assistant.</Say>
        <Pause length="1"/>
        <Say>You can start talking!</Say>
        <Connect>
            <Stream url="wss://9e6660e69843.ngrok.app/media-stream" />
        </Connect>
    </Response>`;

    res.type("text/xml").send(twimlResponse);
});

fastify.register(async (fastify) => {
    fastify.get("/media-stream", { websocket: true }, (connection, req) => {
        console.log("Media stream connected");
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue: string[] = [];
        let responseStartTimestampTwilio: number | null = null;

        const openAiWs = new WebSocket(url, {
            headers: {
                Authorization: "Bearer " + process.env.OPENAI_API_KEY,
                "OpenAI-Beta": "realtime=v1",
            },
        });

        const initializeSession = () => {
            const sessionUpdate = {
                type: "session.update",
                session: {
                    turn_detection: { type: "server_vad" },
                    input_audio_format: "g711_ulaw",
                    output_audio_format: "g711_ulaw",
                    voice: "alloy",
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: 0.8,
                },
            };

            console.log("Sending session update:", JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));
        };

        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                if (lastAssistantItem) {
                    const truncateEvent = {
                        type: "conversation.item.truncate",
                        item_id: lastAssistantItem,
                        content_index: 0,
                        audio_end_ms: elapsedTime,
                    };
                    openAiWs.send(JSON.stringify(truncateEvent));
                }

                connection.send(
                    JSON.stringify({
                        event: "clear",
                        streamSid: streamSid,
                    }),
                );

                // Reset
                markQueue = [];
                lastAssistantItem = null;
                responseStartTimestampTwilio = null;
            }
        };

        const sendMark = (connection, streamSid) => {
            if (streamSid) {
                const markEvent = {
                    event: "mark",
                    streamSid: streamSid,
                    mark: { name: "responsePart" },
                };
                connection.send(JSON.stringify(markEvent));
                markQueue.push("responsePart");
            }
        };

        openAiWs.on("open", () => {
            console.log("Connected to the OpenAI Realtime API");
            setTimeout(initializeSession, 100);
        });

        openAiWs.on("message", (data) => {
            const stringData = data.toString();

            try {
                const response = JSON.parse(stringData);

                if (response.type === "response.audio.delta" && response.delta) {
                    const audioDelta = {
                        event: "media",
                        streamSid: streamSid,
                        media: {
                            payload: Buffer.from(response.delta, "base64").toString("base64"),
                        },
                    };
                    connection.send(JSON.stringify(audioDelta));

                    if (!responseStartTimestampTwilio) {
                        responseStartTimestampTwilio = latestMediaTimestamp;
                    }

                    if (response.item_id) {
                        lastAssistantItem = response.item_id;
                    }

                    sendMark(connection, streamSid);
                }

                if (response.type === "input_audio_buffer.speech_started") {
                    handleSpeechStartedEvent();
                }
            } catch (error) {
                console.error("Error processing OpenAI message:", error, "Raw message:", data);
            }
        });

        connection.on("message", (message) => {
            try {
                const stringMessage = message.toString();
                const data = JSON.parse(stringMessage);

                switch (data.event) {
                    case "media":
                        latestMediaTimestamp = data.media.timestamp;
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: "input_audio_buffer.append",
                                audio: data.media.payload,
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case "start":
                        streamSid = data.start.streamSid;
                        responseStartTimestampTwilio = null;
                        latestMediaTimestamp = 0;
                        break;
                    case "mark":
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                    default:
                        console.log("Received non-media event:", data.event);
                        break;
                }
            } catch (error) {
                console.error("Error parsing message:", error, "Message:", message);
            }
        });

        connection.on("close", () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log("Client disconnected.");
        });

        openAiWs.on("close", () => {
            console.log("Disconnected from the OpenAI Realtime API");
        });

        openAiWs.on("error", (error) => {
            console.error("Error in the OpenAI WebSocket:", error);
        });
    });
});

fastify.listen({ port: 1994 }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port 1994`);
});
