

#include "BLEDevice.h"
#include <Wire.h>
#include "Arduino.h"

// 00001800-0000-1000-8000-00805f9b34fb
// 00001801-0000-1000-8000-00805f9b34fb
// 0000fe8d-0000-1000-8000-00805f9b34fb

#define bleServerName "Muse-7B82"
boolean doConnect = false;
boolean connected = false;

BLEClient *pClient;
BLERemoteService *pRemoteService;
BLEAddress *pServerAddress;
BLERemoteCharacteristic *control_ch;
BLERemoteCharacteristic *humidityCharacteristic;

static BLEUUID MUSE_SERVICE("0000fe8d-0000-1000-8000-00805f9b34fb");

static BLEUUID CONTROL_CHARACTERISTIC("273e0001-4c4d-454d-96be-f03bac821358");
static BLEUUID TELEMETRY_CHARACTERISTIC("273e000b-4c4d-454d-96be-f03bac821358");
static BLEUUID GYROSCOPE_CHARACTERISTIC("273e0009-4c4d-454d-96be-f03bac821358");
static BLEUUID ACCELEROMETER_CHARACTERISTIC("273e000a-4c4d-454d-96be-f03bac821358");

static BLEUUID PPG_AMBIENT_CHARACTERISTIC("273e000f-4c4d-454d-96be-f03bac821358");
static BLEUUID PPG_INFRED_CHARACTERISTIC("273e0010-4c4d-454d-96be-f03bac821358");
static BLEUUID PPG_RED_CHARACTERISTIC("273e0011-4c4d-454d-96be-f03bac821358");

int PPG_FREQUENCY = 64;
int PPG_SAMPLES_PER_READING = 6;

static BLEUUID EEG_9_CHARACTERISTIC("273e0003-4c4d-454d-96be-f03bac821358");
static BLEUUID EEG_7_CHARACTERISTIC("273e0004-4c4d-454d-96be-f03bac821358");
static BLEUUID EEG_8_CHARACTERISTIC("273e0005-4c4d-454d-96be-f03bac821358");
static BLEUUID EEG_10_CHARACTERISTIC("273e0006-4c4d-454d-96be-f03bac821358");
static BLEUUID EEG_AUX_CHARACTERISTIC("273e0007-4c4d-454d-96be-f03bac821358");

int EEG_FREQUENCY = 256;
int EEG_SAMPLES_PER_READING = 12;

static BLERemoteCharacteristic *ctrl_characteristic;
static BLERemoteCharacteristic *accel_characteristic;

char command_0[] = {0x02, 'h', '\n'};
char command_1[] = {0x04, 'p', '5', '0', '\n'};
char command_2[] = {0x02, 's', '\n'};
char command_3[] = {0x02, 'd', '\n'};

const uint8_t notificationOn[] = {0x1, 0x0};
const uint8_t notificationOff[] = {0x0, 0x0};

class MyAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks
{
    void onResult(BLEAdvertisedDevice advertisedDevice)
    {
        Serial.println(advertisedDevice.getName().c_str());
        if (advertisedDevice.getName() == bleServerName)
        {
            advertisedDevice.getScan()->stop();
            pServerAddress = new BLEAddress(advertisedDevice.getAddress());
            doConnect = true;
            Serial.println("Device found. Connecting!");
        }
    }
};

static void accelNotifyCallback(BLERemoteCharacteristic *pBLERemoteCharacteristic,
                                uint8_t *pData, size_t length, bool isNotify)
{
    Serial.print("notification on:");
    for (int i = 0; i < length; i++)
    {
        Serial.print(String(pData[i]) + " ");
        printf("");
    }

    Serial.println(" len: " + String(length));
}

bool connectToServer(BLEAddress pAddress)
{
    pClient = BLEDevice::createClient();
    bool x = pClient->connect(pAddress);
    Serial.println(" - Connected to server: " + String(x));
    Serial.println("[APP] Free memory: " + String(esp_get_free_heap_size()) + " bytes");
    Serial.flush();
    delay(100);
    pRemoteService = pClient->getService(MUSE_SERVICE);
    delay(100);

    Serial.println("[APP] Free memory: " + String(esp_get_free_heap_size()) + " bytes");
    Serial.println(" - Connected to server");
    if (pRemoteService == nullptr)
    {
        Serial.print("Failed to find our service UUID: ");
        Serial.println(MUSE_SERVICE.toString().c_str());
        return (false);
    }

    ctrl_characteristic = pRemoteService->getCharacteristic(CONTROL_CHARACTERISTIC);
    accel_characteristic = pRemoteService->getCharacteristic(ACCELEROMETER_CHARACTERISTIC);

    if (ctrl_characteristic == nullptr || accel_characteristic == nullptr)
    {
        Serial.print("Failed to find our characteristic UUID");
        return false;
    }
    Serial.println(" - Found our characteristics");

    pRemoteService->setValue(CONTROL_CHARACTERISTIC, command_0);
    pRemoteService->setValue(CONTROL_CHARACTERISTIC, command_1);
    pRemoteService->setValue(CONTROL_CHARACTERISTIC, command_2);
    pRemoteService->setValue(CONTROL_CHARACTERISTIC, command_3);

    Serial.println(" - init seq");
    Serial.flush();

    accel_characteristic->registerForNotify(accelNotifyCallback);

    Serial.println(" - nofif on");
    Serial.flush();

    return true;
}

void setup()
{
    Serial.begin(115200);
    BLEDevice::init("");
    delay(1000);
    Serial.println("START_SCAN");

    BLEScan *pBLEScan = BLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setActiveScan(true);
    pBLEScan->start(30);

    connectToServer(*pServerAddress);
}

void loop()
{
    delay(1000);
}