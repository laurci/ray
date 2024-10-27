import { prisma } from "./main";

export async function getPatients() {
    const patients = await prisma.patient.findMany();

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

    return patient;
}

export async function deletePatient(id: string) {
    const patient = await prisma.patient.delete({
        where: {
            id,
        },
    });

    return patient;
}

export async function getPatientPrompt(
    id: string,
    incidentType: string,
    incidentLocation?: string,
): Promise<string | null> {
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

    const prompt = `Acum vorbesti cu un operator al serviciului national de urgențe în numele lui ${patient.name} in varsta de ${patient.age} ani. Te rog să furnizezi locația incidentului și sa descrii cat mai concis ce s-a intamplat pentru ca serviciile de urgență să ajungă cât mai repede. Vorbeste repede, uman, concis si cu o tonalitate mai alerta pentru ca operatorul sa inteleaga ca este vorba de o urgenta si pentru a trimite ajutorul necesar. A avut loc un accident de tipul ${incidentType}. Locatia incidentului este ${incidentLocation}. Daca locatia incidentului nu este disponibila, foloseste adresa pacientului ${patient.address}. ${patient.name} are următorul istoric medical ${patient.medicalHistory}. ${patient.name} este în grija lui ${patient.caretakerName} care poate fi contactat la următorul număr de telefon ${patient.caretakerPhoneNumber}.`;

    return prompt;
}
