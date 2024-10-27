import { FastifyInstance } from "fastify";
import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

const patientDetails = {
    name: "Jonny",
    age: 30,
    birthDate: "1994-11-13",
    medicalHistory: "epilepsy",
    condition: "unconscious",
    emergency: "seizure",
    address: "123 Main St, Springfield, IL",
    currentLocation: "44 Tokyo St, Springfield, IL",
    timeOfIncident: new Date().toLocaleString(),

    vitals: {
        heartRate: 120,
        bloodPressure: "120/80",
        oxygenLevel: 98,
    },
};

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const ngrokUrl = process.env.NGROK_URL;

if (!accountSid || !authToken) {
    console.error(
        "Please provide TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in the environment variables",
    );
    process.exit(1);
}

const client = require("twilio")(accountSid, authToken);
const SYSTEM_MESSAGE = `You are an A.I. assistant that calls on behalf of a human that just had a medical emergency. You have to tell the emergency services what happened and where you are (the person had a seizure and fainted). The person's name is Jonny and he's a 30 years old guy with a medical history of epilepsy. He's currently unconscious and needs immediate medical attention. His current details are ${JSON.stringify(patientDetails)}`;
const SHOW_TIMING_MATH = false;

export default function callRoute(fastify: FastifyInstance) {
    fastify.all<{ Params: { id: string } }>("/call/:id", async (req, res) => {
        console.log("Initiating call... from /call");
        const id = req.params.id;

        const response = await fastify.inject({ method: "GET", url: `/patient/${id}` });

        const patientData = await response.json();

        try {
            console.log("Initiating call...");
            const call = await client.calls.create({
                url: `https://${ngrokUrl}/twiml/${id}`,
                to: "+40757378264", // destination number
                from: process.env.TWILIO_PHONE_NUMBER,
            });

            const message = await client.messages.create({
                body: `Dear ${patientData.caretakerName}, ${patientData.name} has had a medical emergency. The emergency services have been contacted and are on their way at the following address: ${patientData.address}.`,
                to: patientData.caretakerPhoneNumber,
                from: process.env.TWILIO_PHONE_NUMBER,
            });

            console.log("Call initiated");
            res.send({
                message: "Call initiated and message send to the care taker.",
                callSid: call.sid,
            });
        } catch (error) {
            console.error("Error making call:", error);
            res.status(500).send({ error: "Failed to initiate call" });
        }
    });

    fastify.post<{ Params: { id: string } }>("/twiml/:id", (req, res) => {
        console.log("Received TwiML request");
        const id = req.params.id;
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Connect>
                <Stream url="wss://${ngrokUrl}/media-stream/${id}" />
            </Connect>
        </Response>`;

        res.type("text/xml").send(twimlResponse);
    });

    fastify.register(async (fastify) => {
        fastify.get<{ Params: { id: string } }>(
            "/media-stream/:id",
            { websocket: true },
            async (connection, req) => {
                console.log("Media stream connected");
                const id = req.params.id;

                const response = await fastify.inject({
                    method: "GET",
                    url: `/patient-for-agent/${id}`,
                });

                const data = await response.json();

                const patientPrompt = data.patientPrompt;

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

                const initializeSession = (prompt: string) => {
                    console.log("prompt for initializeSession", prompt);
                    const sessionUpdate = {
                        type: "session.update",
                        session: {
                            turn_detection: { type: "server_vad" },
                            input_audio_format: "g711_ulaw",
                            output_audio_format: "g711_ulaw",
                            voice: "alloy",
                            instructions: prompt,
                            modalities: ["text", "audio"],
                            temperature: 0.8,
                        },
                    };

                    console.log("Sending session update:", JSON.stringify(sessionUpdate));
                    openAiWs.send(JSON.stringify(sessionUpdate));
                    sendInitialConversationItem();
                };

                const sendInitialConversationItem = () => {
                    const initialConversationItem = {
                        type: "conversation.item.create",
                        item: {
                            type: "message",
                            role: "user",
                            content: [
                                {
                                    type: "input_text",
                                    text: patientPrompt,
                                },
                            ],
                        },
                    };

                    if (SHOW_TIMING_MATH)
                        console.log(
                            "Sending initial conversation item:",
                            JSON.stringify(initialConversationItem),
                        );
                    openAiWs.send(JSON.stringify(initialConversationItem));
                    openAiWs.send(JSON.stringify({ type: "response.create" }));
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
                    setTimeout(() => initializeSession(patientPrompt), 300);
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
                                    payload: Buffer.from(response.delta, "base64").toString(
                                        "base64",
                                    ),
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
                        console.error(
                            "Error processing OpenAI message:",
                            error,
                            "Raw message:",
                            data,
                        );
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
            },
        );
    });
}
