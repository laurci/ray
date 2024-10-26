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
