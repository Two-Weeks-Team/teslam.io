<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Vehicle Endpoints

> **Source** <https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Vehicle Endpoints
Endpoints
drivers
GET /api/1/vehicles/{vin}/drivers

Returns all allowed drivers for a vehicle. This endpoint is only available for the vehicle owner.

drivers remove
DELETE /api/1/vehicles/{vin}/drivers

Removes driver access from a vehicle. Share users can only remove their own access. Owners can remove share access or their own.

fleet_status
POST /api/1/vehicles/fleet_status

Provides information necessary to determine a vehicle's state as it pertains to the application.

vehicle_command_protocol_required: If the vehicle requires the Vehicle Command Protocol.
safety_screen_streaming_toggle_enabled: If the user has toggled the Allow Third-Party App Data Streaming toggle in the Safety screen. This option is only available on older Model S and Model X vehicles with Intel based car computers.
firmware_version: The firmware version of the vehicle.
fleet_telemetry_version: The version of the fleet telemetry client running on the vehicle. This is used to identify client capabilities.
total_number_of_keys: The number of keys on the vehicle. A maximum of 20 keys are supported.
discounted_device_data: If the vehicle qualifies for discounted vehicle_data calls. This is only available when the endpoint is called with one VIN.
fleet_telemetry_config create
POST /api/1/vehicles/fleet_telemetry_config

Configures vehicles to connect to a self-hosted fleet-telemetry server. This endpoint should be called through the Vehicle Command Proxy. The configured private key will be used to sign the configuration. The endpoint can be used to create or update configurations.

Available fields are described on the Available Data page.

Note: legacy applications configured using a CSR may still call this endpoint directly. It is recommended to transition to using the vehicle-command proxy.

If any specified VINs are not configured, the response will include skipped_vehicles. VINs may be rejected for a few reasons:

missing_key: The virtual key has not been added to the vehicle. Distributing a public key.
unsupported_hardware: Pre-2018 Model S and X are not supported.
unsupported_firmware:

If calling directly, vehicles running firmware version earlier than 2023.20.
If using the vehicle-command HTTP proxy, vehicles running firmware version earlier than 2024.26.
For Intel Atom based Model S or Model X, vehicles running firmware version earlier than 2025.20
max_configs: Vehicles that already have five configurations present.

Fleet Telemetry configuration will automatically be removed if a user revokes an application's access.

fleet_telemetry_config delete
DELETE /api/1/vehicles/{vin}/fleet_telemetry_config

Remove a fleet telemetry configuration from a vehicle. Removes the configuration for any vehicle if called with a partner token.

fleet_telemetry_config get
GET /api/1/vehicles/{vin}/fleet_telemetry_config

Fetches a vehicle's fleet telemetry config. synced set to true means the vehicle has adopted the target config. synced set to false means the vehicle will attempt to adopt the target config when it next establishes a backend connection. Note that the vehicle only allows 3 configurations per vehicle for streaming via fleet telemetry. If limit_reached set to true, vehicle has reached max supported applications and new fleet telemetry requests cannot be added to the vehicle.

fleet_telemetry_config_jws
POST /api/1/vehicles/fleet_telemetry_config_jws

Configures vehicles to connect to a self-hosted fleet-telemetry server by accepting a signed configuration token.

It is not recommended to use this endpoint directly.

The recommended approach for configuring vehicles is calling the fleet_telemetry_config create endpoint through the vehicle-command proxy. This will automatically sign the configuration using the configured private key and forward the request to this endpoint.

If using this endpoint directly, the JWS token must be crafted using a Schnorr signatures algorithm using NIST P-256 and SHA-256.

VINs may be rejected for a few reasons:

missing_key: The virtual key has not been added to the vehicle. Distributing a public key.
unsupported_hardware: Pre-2021 Model S and X are not supported.
unsupported_firmware: Vehicles running firmware version earlier than 2024.26.

fleet_telemetry_errors
GET /api/1/vehicles/{vin}/fleet_telemetry_errors

Returns recent fleet telemetry errors reported for the specified vehicle after receiving the config.

list
GET /api/1/vehicles

Returns vehicles belonging to the account. This endpoint is paginated with a default page size of 100 vehicles.

mobile_enabled
GET /api/1/vehicles/{vin}/mobile_enabled

Returns whether or not mobile access is enabled for the vehicle.

nearby_charging_sites
GET /api/1/vehicles/{vin}/nearby_charging_sites

Returns the charging sites near the current location of the vehicle.

recent_alerts
GET /api/1/vehicles/{vin}/recent_alerts

List of recent alerts

release notes
GET /api/1/vehicles/{vin}/release_notes

Returns firmware release notes.

service_data
GET /api/1/vehicles/{vin}/service_data

Fetches information about the service status of the vehicle.

share_invites
GET /api/1/vehicles/{vin}/invitations

Returns the active share invites for a vehicle. This endpoint is paginated with a max page size of 25 records.

share_invites create
POST /api/1/vehicles/{vin}/invitations
Each invite link is for single-use and expires after 24 hours.
An account that uses the invite will gain Tesla app access to the vehicle, which allows it to do the following:
View the live location of the vehicle.
Send remote commands.
Download the user's Tesla profile to the vehicle.
To remove access, use the revoke API.
If a user does not have the Tesla app installed, they will be directed to this webpage for guidance.
A user can set up their phone as key with the Tesla app when in proximity of the vehicle.
The app access provides DRIVER privileges, which do not encompass all OWNER features.
Up to five drivers can be added at a time .
This API does not require the car to be online.
share_invites redeem
POST /api/1/invitations/redeem

Redeems a share invite. Once redeemed, the account will gain access to the vehicle within the Tesla app.

share_invites revoke
POST /api/1/vehicles/{vin}/invitations/{id}/revoke

Revokes a share invite. This invalidates the share and makes the link invalid.

signed_command
POST /api/1/vehicles/{vin}/signed_command

Signed Commands is a generic endpoint replacing legacy commands. It accepts any of the scopes listed above, depending on the type of command. It uses the Tesla Vehicle Command Protocol to execute commands on a vehicle. Please see the vehicle command SDK - tesla-http-proxy for more information.

vehicle
GET /api/1/vehicles/{vin}

Returns information about a vehicle.

vehicle_data
GET /api/1/vehicles/{vin}/vehicle_data

Makes a live call to the vehicle to fetch realtime information. Regularly polling this endpoint is not recommended and will be expensive. Instead, Fleet Telemetry provides an efficient data stream for online vehicles.

For vehicles running firmware versions 2023.38+, location_data is required to fetch vehicle location. This will result in a location sharing icon to show on the vehicle UI.

wake_up
POST /api/1/vehicles/{vin}/wake_up

Wakes the vehicle from sleep, which is a state to minimize idle energy consumption.
