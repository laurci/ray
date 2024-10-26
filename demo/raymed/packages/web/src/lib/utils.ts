import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface PatientType {
    patientName: string;
    patientAge: string;
    patientAddress: string;
    patientMedicalHistory: string;
    caretakerName: string;
    caretakerPhoneNumber: string;
}

export interface PatientResponse {
    id: string;
    name: string;
    age: string;
    caretakerName: string;
    caretakerPhoneNumber: string;
    medicalHistory?: string;
    address: string;
    incidentLocation?: string;
    createdAt: Date;
    updatedAt: Date;
}
