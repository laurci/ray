# raymed

[**When you're not there, we are.**](https://www.youtube.com/watch?v=6-wBCPosRKU)

raymed is an integrated solution for urgent medical care referral, designed for individuals who require constant medical supervision—such as those with cardiological or neurological conditions, advanced age, or mobility issues.

## How It Works

A caretaker registers the patient in our monitoring system, providing contact details, age, medical history, and current condition. They then receive the raymed monitoring headband.

The headband captures vital signs like brain activity, blood oxygen levels, pulse, and head movement. This data is analyzed in real-time to detect life-threatening events such as seizures, strokes, cardiac or pulmonary issues, and falls.

When an event is detected, the headband signals the raymed monitoring service, which uses the patient's medical history and location to automatically contact local emergency services. The emergency operator interacts with the raymed agent to gather critical information, ensuring an immediate response. The caretaker is also alerted via message.

## Why raymed?

In life-threatening situations, every second counts. Rapid detection and response can mean the difference between life and death. Many individuals who need constant medical supervision lack the resources or companionship to receive it. raymed aims to bridge this gap by providing accessible, real-time monitoring and emergency response.

## Technical Overview

**Data Collection**

We use the **Muse 2 headband** to collect patient vitals via Bluetooth Low Energy (BLE). A Raspberry Pi 4 acts as a base station, connecting to the headband to read values. In future versions, all components will be integrated into a custom headband.

The headband provides:

- **EEG Readings**: Monitoring brain activity.
- **PPG Readings**: Measuring pulse and oxygen saturation.
- **IMU Data**: Detecting movement and falls.

**Incident Detection**

We employ machine learning, specifically an **MLP classifier**, to analyze data streams and detect incidents. The model is trained on normal state samples and synthetic data for conditions like strokes and faints.

**Edge Inference with Ray**

To ensure efficiency and reliability, we perform local inference using **Ray**, our framework for FPGA-accelerated inference on embedded devices. Ray integrates the neural network into FPGA hardware alongside a RISC-V core, enabling low-power, high-performance edge computing.

- **Training**: Utilizing **ray-ml** (Rust) to train and quantize networks to INT8.
- **Hardware Generation**: Using **ray-soc** (Scala, SpinalHDL) to generate inference hardware and a RISC-V core ([VexRiscV](https://github.com/SpinalHDL/VexRiscv)).

**Communication and Alerts**

Upon detecting an incident:

- The system notifies the monitoring service via **AWS IoT Core**.
- Patient information is retrieved from a **PostgreSQL** database.
- An automated call is made to emergency services using **Twilio**.
- The operator interacts with our agent, powered by the OpenAI `o1-realtime` model, for rapid information exchange.
- An SMS alert is sent to the caretaker.

**Note**: The repository is filled with exciting stuff. Dive in to explore more!
