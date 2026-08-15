<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# API Best Practices

> **Source** <https://developer.tesla.com/docs/fleet-api/getting-started/best-practices>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

API Best Practices
Avoid DNS caching

Fleet API high availability is guaranteed by dynamic IPs; addresses behind the DNS can change abruptly during regular operation. Excessive DNS TTL/caching can lead to stale DNS information. This can cause connection issues and errors.

The recommendation is to avoid altering the DNS TTL setting (use the default) to ensure that the DNS resolver is configured to follow the TTL values provided by the authoritative DNS servers.

Avoid polling device data

Fleet API offers two methods to obtain realtime vehicle data: the vehicle data endpoint and Fleet Telemetry. The vehicle data endpoint is meant to be used infrequently and should never be polled regularly. Fleet Telemetry supports ongoing data needs and is significantly cheaper.

Details of the cost reductions possible by migrating to Fleet Telemetry are available on the Billing and Limits page.

Communication and updates

Important updates like breaking API changes will be emailed to Admins and App Developers. Updates that are broadly relevant will be posted to the Announcements section. Ensure all email addresses are registered as an App Developer or Admin on application accounts. To Add/modify contacts navigate to the Account -> User Management section of the Tesla business portal: https://www.tesla.com/teslaaccount/business.

Ensure connectivity state before interacting with a device

It is an application's responsibility to ensure a device is online prior to sending commands. There are two options for monitoring the connectivity state of a vehicle:

Fetch the vehicle endpoint and inspect the state attribute. Ensure it is not offline or asleep.
Monitor connectivity events from Fleet Telemetry.

It is recommended to check connectivity state before sending paid requests such as vehicle data, commands, or wakes. After sending a wake request, it may take 10-60 seconds for the vehicle to connect.

Note: Confirming the vehicle is online does not guarantee a request will be successful. Vehicles with poor connectivity may still return status code 408 (vehicle unavailable).

Ensure virtual key presence prior to sending signed commands

Signed commands allow a vehicle to validate a command is coming from a trusted source. To establish this trust, the vehicle validates a received command is signed with a private key corresponding to a public key securely stored on the vehicle. The suggested method to send a signed command is using the Vehicle Command HTTP proxy.

If the public key (also referred to as virtual key) is not present on the vehicle, the signed command will be rejected. The fleet status endpoint returns the key pairing state of a vehicle. To avoid being billed for a rejected command, ensure the key is present on the vehicle before sending a signed command.

Ensure authorization tokens are not expired before making API calls

Fleet API bearer token used for authorization are simple JWT tokens. Before calling the API, renew tokens if they are within a minute of expiration. Securely caching tokens is a viable option for distributed applications.

Respect local privacy laws and data governance

Fleet API is localized in multiple regions in accordance with local regulation (CCPA, GDPR, PIPL, etc.). The API may return some errors to guide developers, but it is the developer's responsibility to comply with security, data privacy, data transfer, and data governance regulations.

Secure private keys and secrets at all time

Follow best security practices when manipulating private keys and secrets. Modern cloud providers offer key management services (such as AWS Key Management Service, Azure Key Vault, and Google Cloud Key Management Service) or hardware security module (HSM) solutions to create and manage private keys and secrets securely. It is important to not extract or transmit private keys over the network, particularly if they are not encrypted.

Validate vehicle state after timeout errors

Timeouts can happen before or after a command is sent and executed in a vehicle, making it difficult to determine the vehicle's state when a timeout occurs. It is the developer's responsibility to ensure the vehicle is in the desired state. Most Fleet API commands are stateful and can be safely retried, but some commands (such as honk_horn and media_next_track) may result in duplicated actions. Therefore, developers should exercise caution when retrying these commands to avoid unintended consequences.

Rate limits for authentication requests

Authentication requests like refresh token exchange should not exceed 20 req/sec for any application or account. Above this rate may result in an application being throttled or blocked.

Register Partner Accounts to all regions for maximum user compatibility

To maximize user compatibility, register partner accounts in all regions to ensure that users who are out of region are supported properly. All Fleet API regions can be found here and the registration endpoint can be found here.
