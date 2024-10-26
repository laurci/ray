import { PatientType } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pen, Save, Trash, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../components/ui/form";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

const formSchema = z.object({
    patientName: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    patientAge: z.string().min(1, {
        message: "Age must be at least 1 character.",
    }),
    patientAddress: z.string().min(2, {
        message: "Address must be at least 2 characters.",
    }),
    patientMedicalHistory: z.string(),
    caretakerName: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    caretakerPhoneNumber: z.string({
        message: "Please provide a valid phone number",
    }),
});

function Patient() {
    const params = useParams();

    const navigate = useNavigate();

    const [patient, setPatient] = useState<PatientType | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [message, setMessage] = useState("");

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ...patient,
        },
    });

    console.log("form", form);

    const LABELS: { [key in keyof PatientType]: string } = {
        patientName: "Patient name",
        patientAge: "Patient age",
        patientAddress: "Patient address",
        patientMedicalHistory: "Patient medical history",
        caretakerName: "Caretaker name",
        caretakerPhoneNumber: "Caretaker phone number",
    };

    const onSave = async (values: z.infer<typeof formSchema>) => {
        const patient: PatientType = {
            patientName: values.patientName,
            patientAge: values.patientAge,
            patientAddress: values.patientAddress,
            patientMedicalHistory: values.patientMedicalHistory,
            caretakerPhoneNumber: values.caretakerPhoneNumber,
            caretakerName: values.caretakerName,
        };

        await fetch(`${import.meta.env.VITE_API_URL}/patient/${params.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(patient),
        })
            .then((res) =>
                res
                    .json()
                    .then(async (data) => {
                        setMessage(data.message);
                        await fetchPatient();
                    })
                    .catch((err) => setMessage(err.message)),
            )
            .catch((err) => console.log("Error on registering patient", err));
        console.log(patient);
        setIsEditMode(false);
    };

    const registerDisabled = form.formState.isSubmitting || !form.formState.isValid || !isEditMode;

    const fetchPatient = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/patient/${params.id}`);
            const data = await response.json();

            console.log("data", data);
            setPatient({
                patientName: data.name,
                patientAge: data.age,
                patientAddress: data.address,
                patientMedicalHistory: data.medicalHistory,
                caretakerName: data.caretakerName,
                caretakerPhoneNumber: data.caretakerPhoneNumber,
            });

            form.setValue("patientName", data.name);
            form.setValue("patientAge", data.age);
            form.setValue("patientAddress", data.address);
            form.setValue("patientMedicalHistory", data.medicalHistory);
            form.setValue("caretakerName", data.caretakerName);
            form.setValue("caretakerPhoneNumber", data.caretakerPhoneNumber);
        } catch (error) {
            console.log(error);
        }
    };

    const handleDelete = async () => {
        await fetch(`${import.meta.env.VITE_API_URL}/patient/${params.id}`, {
            method: "DELETE",
        })
            .then((res) =>
                res
                    .json()
                    .then(() => navigate("/"))
                    .catch((err) => setMessage(err.message)),
            )
            .catch((err) => console.log("Error on registering patient", err));
    };

    useEffect(() => {
        fetchPatient();
    }, [params.id]);

    if (!patient) {
        return <p>no patient data</p>;
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-8">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSave)} className="w-full space-y-8">
                    {Object.keys(patient).map((key) => (
                        <FormField
                            key={key}
                            control={form.control}
                            name={key as keyof typeof patient}
                            render={({ field }) => {
                                return (
                                    <FormItem className="flex flex-col items-start space-y-2 lg:min-w-[500px]">
                                        <FormLabel>{LABELS[key as keyof PatientType]}</FormLabel>
                                        <FormControl>
                                            {field.name === "patientMedicalHistory" ? (
                                                <Textarea
                                                    rows={5}
                                                    disabled={!isEditMode}
                                                    {...field}
                                                />
                                            ) : (
                                                <Input disabled={!isEditMode} {...field} />
                                            )}
                                        </FormControl>

                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />
                    ))}

                    <div className="flex flex-row items-center gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditMode(!isEditMode)}
                        >
                            {!isEditMode ? (
                                <>
                                    Edit details <Pen />
                                </>
                            ) : (
                                <>
                                    Cancel editing <X />
                                </>
                            )}
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleDelete}>
                            Delete patient
                            <Trash />
                        </Button>
                        <Button
                            type="submit"
                            className="bg-green-400 hover:bg-green-500"
                            disabled={registerDisabled}
                        >
                            Save <Save />
                        </Button>
                    </div>
                </form>
            </Form>

            {message && <p className="font-semibold text-green-600">{message} &#9989;</p>}
        </div>
    );
}

export default Patient;
