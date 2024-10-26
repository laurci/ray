import { FastifyInstance } from "fastify";
import { RouteShorthandOptions } from "fastify/types/route";
import {
    createPatient,
    deletePatient,
    getPatientById,
    getPatients,
    updatePatient,
} from "../../db/patient";
import { FormStructure } from "../../utils/types";

async function patientRoutes(fastify: FastifyInstance, options: RouteShorthandOptions) {
    fastify.get("/patients", async (request, reply) => {
        const patients = await getPatients();
        if (patients.length === 0) {
            reply.send({ patients: [], message: "No patients found" });
            return;
        }
        reply.send(patients);
    });

    fastify.get<{ Params: { id: string } }>("/patient/:id", async (request, reply) => {
        const patientId = request.params.id;

        if (!patientId) {
            reply.code(400).send({ error: "id is required" });
            return;
        }

        const patient = await getPatientById(patientId);
        reply.send(patient);
    });

    fastify.post<{
        Body: FormStructure;
    }>("/patient", async (request, reply) => {
        const {
            caretakerName,
            caretakerPhoneNumber,
            patientAddress,
            patientAge,
            patientMedicalHistory,
            patientName,
        } = request.body;

        if (
            !patientName ||
            !patientAge ||
            !patientAddress ||
            !patientMedicalHistory ||
            !caretakerName ||
            !caretakerPhoneNumber
        ) {
            reply.code(400).send({ error: "All form data are required" });
            return;
        }

        const patient = await createPatient(
            patientName,
            patientAge,
            patientAddress,
            patientMedicalHistory,
            caretakerName,
            caretakerPhoneNumber,
        );
        reply.send({ success: true, message: "Patient registered successfully", patient });
    });

    fastify.patch<{ Params: { id: string }; Body: FormStructure }>(
        "/patient/:id",
        async (request, reply) => {
            const patientId = request.params.id;
            const {
                caretakerName,
                caretakerPhoneNumber,
                patientAddress,
                patientAge,
                patientMedicalHistory,
                patientName,
            } = request.body;

            if (
                !patientName ||
                !patientAge ||
                !patientAddress ||
                !patientMedicalHistory ||
                !caretakerName ||
                !caretakerPhoneNumber
            ) {
                reply.code(400).send({ error: "All form data are required" });
                return;
            }

            const patient = await updatePatient(
                patientId,
                patientName,
                patientAge,
                patientAddress,
                patientMedicalHistory,
                caretakerName,
                caretakerPhoneNumber,
            );
            reply.send({ success: true, message: "Patient updated successfully", patient });
        },
    );

    fastify.delete<{ Params: { id: string } }>("/patient/:id", async (request, reply) => {
        const patientId = request.params.id;

        if (!patientId) {
            reply.code(400).send({ error: "id is required" });
            return;
        }

        const patient = await deletePatient(patientId);

        if (!patient) {
            reply.code(404).send({ error: "Patient not found" });
            return;
        }

        reply.send({ success: true, message: "Patient deleted successfully" });
    });
}

export default patientRoutes;
