import { AvatarIcon } from "@radix-ui/react-icons";

interface PatientsItemProps {
    name: string;
    age: string;
    address: string;
    caretakerName: string;
    caretakerPhoneNumber: string;
    id: string;
    onClick: (id: string) => void;
}

function PatientsItem(props: PatientsItemProps) {
    return (
        <div
            onClick={() => props.onClick(props.id)}
            className="flex min-w-[400px] cursor-pointer flex-row justify-between rounded-3xl border-2 border-green-100 bg-gradient-to-br from-green-100 via-lime-100 to-emerald-100 p-6 text-neutral-900 transition-all hover:-translate-y-1 hover:border-green-400 hover:shadow-lg"
        >
            <div className="flex flex-col items-start gap-2">
                <p className="text-sm">
                    <span className="font-semibold">Name: </span>
                    {props.name}
                </p>
                <p className="text-sm">
                    <span className="font-semibold">Age: </span>
                    {props.age}
                </p>
                <p className="text-sm">
                    <span className="font-semibold">Address: </span>
                    {props.address}
                </p>
                <p className="text-sm">
                    <span className="font-semibold">Caretaker name: </span>
                    {props.caretakerName}
                </p>
                <p className="text-sm">
                    <span className="font-semibold">Caretaker phone: </span>
                    {props.caretakerPhoneNumber}
                </p>
            </div>

            <AvatarIcon className="h-12 w-12 text-neutral-900" />
        </div>
    );
}

export default PatientsItem;
