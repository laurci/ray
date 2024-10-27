import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { PatientType } from "../lib/utils";

const LABELS: { [key in keyof PatientType]: string } = {
    patientName: "Patient name",
    patientAge: "Patient age",
    patientAddress: "Patient address",
    patientMedicalHistory: "Patient medical history",
    caretakerName: "Caretaker name",
    caretakerPhoneNumber: "Caretaker phone number",
};

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

const patientDefault: PatientType = {
    patientName: "",
    patientAge: "",
    patientAddress: "",
    patientMedicalHistory: "",
    caretakerName: "",
    caretakerPhoneNumber: "",
};

function App() {
    const [message, setMessage] = useState("");

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            patientName: "",
            caretakerName: "",
            caretakerPhoneNumber: "",
            patientAge: "",
            patientAddress: "",
            patientMedicalHistory: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        const patient: PatientType = {
            patientName: values.patientName,
            patientAge: values.patientAge,
            patientAddress: values.patientAddress,
            patientMedicalHistory: values.patientMedicalHistory,
            caretakerPhoneNumber: values.caretakerPhoneNumber,
            caretakerName: values.caretakerName,
        };

        await fetch(`${import.meta.env.VITE_API_URL}/patient`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(patient),
        })
            .then((res) =>
                res
                    .json()
                    .then((data) => setMessage(data.message))
                    .catch((err) => setMessage(err.message)),
            )
            .catch((err) => console.log("Error on registering patient", err));
        form.reset();
    };

    const registerDisabled = form.formState.isSubmitting || !form.formState.isValid;

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-8 p-12">
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex w-full flex-col space-y-8"
                >
                    {Object.keys(patientDefault).map((key) => (
                        <FormField
                            key={key}
                            control={form.control}
                            name={key as keyof typeof patientDefault}
                            render={({ field }) => {
                                return (
                                    <FormItem className="flex flex-col items-start space-y-2 lg:min-w-[500px]">
                                        <FormLabel>{LABELS[key as keyof PatientType]}</FormLabel>
                                        <FormControl>
                                            {field.name === "patientMedicalHistory" ? (
                                                <Textarea rows={5} {...field} />
                                            ) : (
                                                <Input {...field} />
                                            )}
                                        </FormControl>

                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />
                    ))}

                    <Button type="submit" className="self-end" disabled={registerDisabled}>
                        Register patient <ClipboardCheck />
                    </Button>
                </form>
            </Form>
            {message && <p className="font-semibold text-green-600">{message} &#9989;</p>}
        </div>
    );
}

export default App;
