<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Announcements and Changelog

> **Source** <https://developer.tesla.com/docs/fleet-api/announcements>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Announcements and Changelog
2025-12-12: Self-Driving Statistics Available in Fleet Telemetry

Two new fields have been introduced to Fleet Telemetry: MilesSinceReset and SelfDrivingMilesSinceReset.

View additional information in the Fleet Telemetry Changelog and Available Data pages.

This is the only verifiable and authoritative source of Self-Driving usage data. Reliance on any other method is unsupported, speculative, and risks producing materially inaccurate conclusions.

These fields are only available on HW4 vehicles running firmware version 2025.44.25.5 or later.

2025-09-22: Discounted Vehicle Data Pricing Date Change

The vehicle data discount for Model S and Model X Intel Atom vehicles has been extended to Oct 1, 2025. These vehicles may stream additional erroneous invalid signals, which should not impact actual state changes from being streamed.

2025-07-21: Use fleet-auth.prd.vn.cloud.tesla.com domain for token exchange

Fleet API has hosted a domain for token exchange with higher rate limits since late 2024: fleet-auth.prd.vn.cloud.tesla.com. Beginning August 2025 the auth.tesla.com domain will have modifications that may make token generation unrelaible for Partner applications. All Partners must migrate from auth.tesla.com to fleet-auth.prd.vn.cloud.tesla.com for token exchange and other server to server calls like metadata lookup.

2025-06-26: Discounted Vehicle Data Pricing Update

The Model S and Model X vehicles which now support Fleet Streaming have previously received discounted pricing for calls to the vehicle data endpoint. This discount will be removed effective September 1, 2025.

2025-06-26: Fleet Telemetry Support for Model S and Model X Intel Atom Vehicles

Firmware version 2025.20 adds Fleet Telemetry support for Model S and Model X vehicles with Intel Atom car computers. Once these vehicles receive the required firmware version, the fleet_status endpoint will begin reporting a non-null fleet_telemetry_version.

These vehicles do not require a Virtual Key; instead, a user with access to the vehicle must enable "Allow Third-Party App Data Streaming" in the Safety screen of the vehicle. For vehicles with the required firmware version installed, the fleet_status endpoint will return safety_screen_streaming_toggle_enabled as true or false, depending on the toggle's state.

2025-06-05: Prefer typed always true for Fleet Telemetry

Beginning in August 2025, vehicles will ignore the Fleet Telemetry configuration prefer_typed option and will always send typed data as if prefer_typed was configured to true.

2025-05-09: Mobile App Third-Party App Command Usage Tracking

Vehicle owners can now track third-party app usage on their mobile apps for their vehicles. This is available in the mobile app under User Profile > Security & Privacy > Third-Party Apps.

2025-02-19: Fleet Telemetry Changelog

Future changes to Fleet Telemetry capabilities will be documented in the Fleet Telemetry Changelog.

2025-01-22: New Fleet API Support Help Center

We’re pleased to announce the launch of our new Fleet API Support Center, designed to simplify and enhance how you submit support requests. As part of this transition, our previous support email, fleetapi-support@tesla.com, will be phased out and will no longer accept inquiries. To submit support requests, please click the Support Inquiry link from within the developer dashboard: https://developer.tesla.com/dashboard.

2025-01-09: New Fleet Telemetry configuration options

Vehicles running firmware version 2024.44.32 and later now support two per-field configuration options for Fleet Telemetry.

minimum_delta: The amount a field's value must change before it is considered changed. This is useful for fields that frequently change insignificant amounts (ChargerVoltage, InsideTemp, etc). This option requires prefer_typed to be set to true. Only numeric fields are supported.
resend_interval_seconds: Resend a field's value every x seconds, even if its value has not changed. Vehicles must be running firmware version 2024.44.32 or later.
2024-12-08: Billing and usage optimization guide

Best practices, cost optimizations, and billing guidance is now available on the Billing and Limits page.

2024-12-08: Location scope update

Thank you to the partners who have already completed the program changes described in communication dated 26 November 2024. For those still completing their changes, to prevent disruption to your services, Tesla will also send reminders about the changes starting in March. After the reminder period, access will be blocked.

2024-11-27: Pay-per-use pricing

Since launch, Fleet API has been made available to partners free of charge as part of the discovery period.

Beginning January 1, 2025, Fleet API will begin charging for access. Pricing details are available on the home page.

During the transition period, the application management dashboard will show charges based on application usage. Payment will be waived for charges accumulated prior to January 1, 2025. The estimated charges should be used to understand and optimize application usage.

Starting January 1, 2025, payment for Fleet API applications will take effect. To ensure continued service, applications must take action:

Configure a billing method in the application management dashboard.
Set a billing threshold to protect from unexpected charges (recommended). Applications above the specified limit will not be disabled prior to January 1, 2025.
Optimize application behavior to improve usage.
Migrate from polling the vehicle_data endpoint to using Fleet Telemetry.
Vehicle wakes should be used sparingly.
Before sending a command, confirm the application's virtual key is present on the vehicle and the vehicle is awake. Wake state can be monitored through Fleet Telemetry or the vehicle endpoint.
Further suggestions are available on the Best Practices page.

Not all countries support payments at this time. Developers in countries that do not yet support payments will not have a Billing and Usage button in their application management dashboard. Developers in these countries should work to optimize their applications but do not need to take action at this time. Applications created from countries that do not support payment will have limited usage beginning in January 2025.

2024-11-26: Introducing a new OAuth scope: "vehicle_location"

This scope provides more granular data access control to developers and users. To users it will appear as "Allow access to your vehicle location information, including data such as precise location, and coarse location for approximate location services."

What does this mean for application developers and users?
Developers: Applications can now request the vehicle_location scope when authorizing users, allowing them to access vehicle location information.
Users: The vehicle_location scope will now appear on the authorization page for applications that require it.
Migration plan
November 2024 - vehicle_location scope is introduced. The /authorize page will show users the vehicle_location scope when loaded with the vehicle_device_data scope. After the migration period, the vehicle_location scope will be need to be explicitly requested.
December 2024 - Where required for partner application use cases, partners must start explicitly requesting the vehicle_location scope for new authorizations, and directing existing users to authorize the vehicle_location scope.
January 2025 - Authorization grants without the vehicle_location scope will lose access to location related functionality.

Request Only Necessary Scopes: In line with Fleet API Agreement and to enable user trust and safety, it is only permissible to request authorization for scopes that are immediately necessary for the application to function.

Refer the scopes for more information.

2024-10-22: Generate Third-Party Business Token

Ability to generate a token on behalf of a business is now live. See here for more information.

2024-08-30: Charging and Preconditioning Schedule Commands Support

The charging and preconditioning schedule commands are now supported via Fleet API. These should be preferred over the scheduled charging and departure commands.

Vehicles must be running firmware version 2024.26 or later.

2024-08-15: Self-service Fleet Telemetry

Fleet Telemetry onboarding no longer requires submitting a CSR to Tesla. Vehicles running firmware version 2024.26.4 or later can receive configurations through the Vehicle Command Proxy. Full setup details are available on the Fleet Telemetry page.

Applications with CSRs submitted but not processed should migrate to using the new Vehicle Command approach.

Applications configured using a CSR will continue to work, but are encouraged to migrate to the new process.

2024-05-20: Application scope updates

Application scopes can now be updated on developer.tesla.com by clicking the API & Scopes Manage link in the Credentials & API section of an application. As described in #5 of the third-party token, users can update scopes and revoke access to applications using the update/revocation auth.tesla.com page. Note: Application scope changes may take up to 10 minutes to become active.

2024-03-26: Shutting down Legacy vehicle API endpoints

Fleet API is Tesla's official 3rd party API and the only supported API for vehicle interactions. The list of available endpoints can be found at Endpoints and Regional Requirements. Starting April 2024, any vehicle APIs not part of this list will be phased out. Per the Fleet API policies, continued usage of unsupported APIs will result in the revocation of Fleet API access privileges.

2024-02-02: Public key must remain available for pairing continuity

With the release of Tesla mobile app 4.30.0, vehicle pairing will require the application public key to remain hosted at the /.well-known/ path on the domain used for application registration. This is a security improvement that includes partner domains in the chain of trust for vehicle interactions. See the check_csr script for an example testing the presence of the registerd public key on the application domain.

2024-02-01: Auth Access token policy change

As part of a security improvement, the acquisition of a new Refresh token will now render the user’s previous Refresh token and its associated Access tokens invalid.

2024-01-02: Adding support for registering vehicles for Fleet Telemetry

Registering vehicles for Fleet Telemetry is now live. See here for more information.

2023-11-17: Vehicle commands endpoint deprecation timeline

Calls directly to the /command endpoint without the use of the Tesla Vehicle Commands protocol SDK will be deprecated. For command continuity, migrate to the Tesla Vehicle Commands protocol as soon as possible:

Dates	Change
November 2023	Newly delivered vehicles* will only support the Tesla Vehicle Command protocol after this date
Nov - Dec 2023	REST API support will be deprecated on existing customer vehicles that have not used the REST API in the preceding 30 days
January 2024	All vehicles* will require Tesla Vehicle Command protocol. The REST API will be fully deprecated
*Fleet accounts are excluded from these changes until further notice. Pre-2021 Model S/X are excluded from these changes.	

When calling the /command endpoint for a vehicle that requires the Tesla Vehicle Command protocol, Fleet API will return an error.

2023-10-24: Vehicle data update on firmware versions 2023.38+

Vehicles running firmware versions 2023.38+ will not return location information by default in vehicle data. Developers who need that information will need to add "location_data" parameter to the query, see here. This will result in a location sharing icon to show on the vehicle UI.

Important: Fetching vehicle data periodically is not recommended, see Fleet Telemetry for streaming needs.

2023-10-09: Rest API vehicle commands endpoint - deprecation warning

Following the release of Tesla Vehicle Command SDK support for REST API vehicle command endpoints is now reaching end of life. Starting 2024 most vehicles will require sending commands via Tesla Vehicle Command SDK.

The use of Tesla http proxy is recommended for ease of development and to accelerate the transition to Tesla Vehicle Command (via SDK). When applicable, the proxy will transform Rest API HTTP commands into the Tesla Vehicle Command Protocol. Once configured, developers can simply point their application to the proxy without making any code changes to their application.

2023-10-09: Tesla Vehicle Command SDK

Tesla Vehicle Command SDK provides end-to-end authentication for sending commands to vehicles. This is the recommended way of sending commands to vehicles.

Security experts are encouraged to dive more into the protocol and give feedback on Github. To report a security issue, follow the directions on https://www.tesla.com/legal/security.
