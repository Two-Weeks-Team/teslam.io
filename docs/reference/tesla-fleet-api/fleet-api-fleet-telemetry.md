<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Fleet Telemetry

> **Source** <https://developer.tesla.com/docs/fleet-api/fleet-telemetry>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Fleet Telemetry

Fleet Telemetry is the most efficient and effective way of gathering data from vehicles. It allows vehicles to stream data directly to a server, eliminating the need to poll the vehicle_data endpoint. This prevents unnecessary vehicle wakes and battery drain. Fleet Telemetry is not fully equivalent to the vehicle data endpoint but provides important data in an efficient and economical manner. See Cost Optimization Case Studies for details of the cost savings available by using Fleet Telemetry.

Server Setup

The Fleet Telemetry server must be running on a server exposed to the public internet. The GitHub repository has source code and examples of running the server.

Vehicle Setup

To configure a vehicle, confirm all pre-requisites are met. Then, send a configure Fleet Telemetry request through the vehicle-command HTTP proxy. The proxy will sign the configuration using the configured private key and forward the request to Fleet API.

Prerequisites

For a vehicle to be able to stream data, a few conditions must be met:

Vehicles must be running firmware version 2024.26 or later.
Applications configured with the legacy certificate signing process require firmware version 2023.20.6 or later.
Model S and Model X vehicles with Intel Atom car computers require firmware version 2025.20 or later.
The virtual key is paired with the vehicle.
Pairing a Key

To pair a key to the vehicle, direct the user to:

https://tesla.com/_ak/developer-domain.com

This will allow the user to add the key to their vehicle through the Tesla mobile app.

Troubleshooting:

If receiving a message stating the user has not granted this third-party app access, ensure the user is logged into the Tesla app with the same email used when authorizing the third-party application.
If receiving a message stating the application has not registered with Tesla, ensure the register endpoint has been called for the region the user is located in. This error will also show if the application's public key is no longer available at the /.well-known/ path on the domain used for application registration. This became a requirement here.
Configuring a Vehicle

Once all pre-requisites are met, use the Fleet Telemetry configure endpoint to send the desired configuration to the vehicle. Configurations are signed and cannot be edited by Tesla. If a required authorization scope is revoked, making a configuration invalid, the configuration will be removed from the vehicle. A vehicle can be configured to stream data to five third-party applications at a time.

A full list of fields are available in the open source repository's vehicle_data.proto file. Documentation improvements for available fields are coming soon.

Note: vehicle_location scope is required for the following fields: Location, OriginLocation, DestinationLocation, DestinationName, RouteLine, GpsState, GpsHeading

Configure Vehicle Endpoint

Troubleshooting:

If a vehicle is configured and awake, but does not begin streaming, check the following:
Ensure the host and CA in your configuration is compatible with your server using check_server_cert.sh.
Ensure the application public key is present on the vehicle using the fleet_status endpoint. Note: the key state reported in this endpoint may have some lag.
System Behavior

Fleet Telemetry consists of two event loops:

The event collector gathers data in 500 millisecond buckets. Once 500 milliseconds has elapsed, all fields that have emitted values are delivered to the remote server.
Each field's value is only sent to the event collector once two conditions are met: interval_seconds has elapsed since the field was last emitted and the field's value has changed.

System state transitions:

Assume the "VehicleSpeed" field is being streamed with interval_seconds set to 1.

Time	Event	Action
0ms	Process starts.	Begin listening for field changes. All fields are received shortly after startup. In this case, speed is received at 100ms.
100ms	Receive speed of 0mph.	Immediately push to event collector since no value has been seen previously.
500ms	Event collector loop triggers.	Vehicle speed is sent from event collector to remote server.
600ms	Speed changes to 1mph.	The value is not pushed to event collector since interval_seconds has not elapsed.
1000ms	Event collector loop triggers.	No data is sent to remote server since no updated fields received.
1100ms	Speed changes to 2mph.	The value is not pushed to event collector since interval_seconds has not elapsed. The previous value of 1mph is discarded.
1300ms	interval_seconds has elapsed.	Immediately push data to event collector since speed has changed since last publish (from 0mph to 2mph).
1500ms	Event collector loop triggers.	Speed of 2mph is sent.
2000ms	Event collector loop triggers.	No data is sent to remote server since no updated fields received.
2300ms	interval_seconds has elapsed.	Nothing is pushed to the event collector since speed has not changed.
2400ms	Speed changes to 3mph.	Immediately push to the event collector since interval_seconds has already elapsed.
2500ms	Event collector loop triggers.	Speed of 3mph is sent.

Failure handling:

Loss of connectivity: the vehicle will buffer 5000 messages which is at least 2,500 seconds of data. Once reconnected, all messages will be delivered.
Server disconnect: the vehicle will buffer messages, as described above. It will attempt to reconnect in an exponential backoff with a maximum retry delay of 30 seconds.
A vehicle's connectivity state can be monitored through Fleet Telemetry connectivity events.
Example Configuration Pricing Analysis

This is a sample configuration which collects data from the most commonly used fields when building applications.

{
    "fields": {
        "VehicleSpeed": { "interval_seconds": 10 },
        "Location": { "interval_seconds": 10 },
        "Soc": { "interval_seconds": 60 },
        "DoorState": { "interval_seconds": 1 },
        "Odometer": { "interval_seconds": 60 },
        "Locked": { "interval_seconds": 1 },
        "EstBatteryRange": { "interval_seconds": 60 },
        "ChargeAmps": { "interval_seconds": 1 },
        "DetailedChargeState": { "interval_seconds": 1 },
        "VehicleName": { "interval_seconds": 1 },
        "TpmsPressureFl": { "interval_seconds": 1 },
        "TpmsPressureFr": { "interval_seconds": 1 },
        "TpmsPressureRl": { "interval_seconds": 1 },
        "TpmsPressureRr": { "interval_seconds": 1 },
        "TpmsLastSeenPressureTimeFl": { "interval_seconds": 1 },
        "TpmsLastSeenPressureTimeFr": { "interval_seconds": 1 },
        "TpmsLastSeenPressureTimeRl": { "interval_seconds": 1 },
        "TpmsLastSeenPressureTimeRr": { "interval_seconds": 1 }
    }
}

During regular driving, a small subset of the desired fields are regularly streamed thanks to change based streaming described above.

VehicleSpeed: 6 signals per minute
Location: 6 signals per minute
Soc: 1 signal per minute
Odometer: 1 signal per minute
EstBatteryRange: 1 signal per minute
Remaining fields: not streamed regularly

This results in approximately 15 signals streamed per minute of driving, yielding a cost of $0.0001/minute or $0.006/hour.

The other fields are streamed on vehicle startup and infrequently as the value changes. For this estimation, generously assume each field is streamed 3 extra times per hour. This results in 18 * 3 = 54 additional signals, yielding a cost of $0.00036/hour.

For this basic configuration, an hour of driving would cost about $0.00636.

Changelog

The vehicle publishes a Fleet Telemetry client version on connection and through the fleet status endpoint. This version can be used to identify the capabilities of a given vehicle.

1.0.0
Firmware versions this change is introduced in:
2025.2.6
2024.45.32.20
New fields have been added, see Available Data for latest fields.
A new configuration option delivery_policy has been introduced. When set to latest, the vehicle will resend data which is not acknowledged by the server. When data is resent, all un-acked data will be resent. This requires Fleet Telemetry server version 0.7.1 or later.
Location fields now support minimum_delta. Changes in distance are measured in meters.
The vehicle now publishes its Fleet Telemetry client version on connection and through the fleet status endpoint.
1.1.0
The prefer_typed configuration option has been removed. All data is now returned typed.
1.2.0
This change is included in firmware version 2025.44.25.5.
Self Driving statistic fields have been added to Fleet Telemetry. The new field names are MilesSinceReset and SelfDrivingMilesSinceReset. Documentation is available on the Available Data page. These fields are only available on HW4 vehicles.
