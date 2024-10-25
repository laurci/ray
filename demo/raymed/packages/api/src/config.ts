import { createEnvParser } from "@baeta/env";

const parse = createEnvParser((key) => {
    return process.env[key];
});

export const config = {
    server: {
        port: parse("PORT", { type: "number", default: 1994 }),
        host: parse("HOST", { type: "string", default: "0.0.0.0" }),
    },
    admin: {
        baseUrl: parse("ADMIN_BASE_URL", {
            type: "string",
            required: true,
            default: "http://localhost:1996",
        }),
    },
    // cog: {
    //     apiUrl: parse("COG_API_URL", { type: "string", required: true }),
    // },
    cups: {
        apiUrl: parse("CUPS_API_URL", {
            type: "string",
            required: true,
            default: "http://192.168.1.103:8631/printers/DNP",
        }), // http://192.168.1.103:8631/printers/DNP
    },
    aws: {
        region: parse("AWS_REGION", { type: "string", default: "eu-central-1" }),
        credentials: {
            accessKeyId: parse("AWS_ACCESS_KEY_ID", { type: "string", required: true }),
            secretAccessKey: parse("AWS_SECRET_ACCESS_KEY", { type: "string", required: true }),
        },
        s3: {
            bucket: parse("AWS_S3_BUCKET", { type: "string", required: true }),
            publicBaseUrl: parse("AWS_S3_PUBLIC_BASE_URL", { type: "string", required: true }),
        },
    },
};
