import { Application } from "express";

const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

export async function registerCallRouter(app: Application) {
    app.get("/call", async (req, res) => {
        client.calls
            .create({
                url: "http://demo.twilio.com/docs/voice.xml",
                to: "+40757378264",
                from: process.env.TWILIO_PHONE_NUMBER,
            })
            .then((call) => {
                console.log(call.sid);
            });
    });
}
