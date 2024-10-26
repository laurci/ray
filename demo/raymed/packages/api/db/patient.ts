import { prisma } from "./main";

export async function getPatients() {
    const patients = await prisma.patient.findMany();
    console.log("patients in getPatients db ----", patients);

    if (patients.length === 0) {
        return [];
    }
    return patients;
}

export async function getPatientById(id: string) {
    const patient = await prisma.patient.findUnique({
        where: {
            id,
        },
    });
    console.log(patient);
    return patient;
}

export async function createPatient(
    patientName: string,
    patientAge: string,
    patientAddress: string,
    patientMedicalHistory: string,
    caretakerName: string,
    caretakerPhoneNumber: string,
) {
    const patient = await prisma.patient.create({
        data: {
            name: patientName,
            age: patientAge,
            address: patientAddress,
            medicalHistory: patientMedicalHistory,
            caretakerName,
            caretakerPhoneNumber,
        },
    });

    console.log(patient);

    return patient;
}

export async function updatePatient(
    id: string,
    patientName: string,
    patientAge: string,
    patientAddress: string,
    patientMedicalHistory: string,
    caretakerName: string,
    caretakerPhoneNumber: string,
) {
    const patient = await prisma.patient.update({
        where: {
            id,
        },
        data: {
            name: patientName,
            age: patientAge,
            address: patientAddress,
            medicalHistory: patientMedicalHistory,
            caretakerName,
            caretakerPhoneNumber,
        },
    });

    console.log(patient);

    return patient;
}

export async function deletePatient(id: string) {
    const patient = await prisma.patient.delete({
        where: {
            id,
        },
    });

    console.log(patient);

    return patient;
}

export async function getPatientPrompt(id: string) {
    const patient = await prisma.patient.findUnique({
        where: {
            id,
        },
        select: {
            name: true,
            age: true,
            address: true,
            medicalHistory: true,
            caretakerName: true,
            caretakerPhoneNumber: true,
        },
    });

    if (!patient) {
        return null;
    }

    const prompt = `You are tasked to assist ${patient.name} who is ${patient.age} years old. ${patient.name} lives at ${patient.address}. ${patient.name} has a medical history of ${patient.medicalHistory}. ${patient.name} is taken care of by ${patient.caretakerName} who can be reached at ${patient.caretakerPhoneNumber}. You are calling the emergency service on behalf of ${patient.name}. Please provide the location of the incident and any other necessary details for the emergency services to arrive as soon as possible to take care of ${patient.name}.`;

    return prompt;
}
