import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PatientsItem from "../components/PatientsItem";

function Home() {
    const [patients, setPatients] = useState([]);
    const navigate = useNavigate();

    const handleGoToPatient = (id: string) => {
        navigate(`/patient/${id}`);
    };

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/patients`);
                const data = await response.json();

                console.log("data");
                setPatients(data);
                console.log(data);
            } catch (error) {
                console.log(error);
            }
        };

        fetchPatients();
    }, []);

    return (
        <div className="flex w-full flex-col items-center justify-center p-12">
            <div className="flex flex-row flex-wrap justify-center gap-12 md:justify-normal">
                {patients.length > 0 ? (
                    patients.map((patient: any) => (
                        <PatientsItem onClick={handleGoToPatient} key={patient.id} {...patient} />
                    ))
                ) : (
                    <p>No patients registered yet.</p>
                )}
            </div>
        </div>
    );
}

export default Home;
