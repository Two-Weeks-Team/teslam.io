<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Developer's Guide to Virtual Keys

> **Source** <https://developer.tesla.com/docs/fleet-api/virtual-keys/developer-guide>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Developer's Guide to Virtual Keys

A virtual key is a public/private key pair which enables authorization when interacting with a vehicle. The public key must be added to the vehicle by a trusted user and the private key is kept securely on the application's server. Before executing a command or accepting a Fleet Telemetry configuration, the vehicle ensures the payload is signed by a private key whose public key is present on the vehicle.

Design Explanation

The virtual key provides a crucial layer of protection for users. Adding the key to a vehicle requires a trusted user-in-the-loop, preventing even Tesla's backend from accessing these capabilities. This ensures only authorized parties are able to execute commands or access device data through Fleet Telemetry. If at any time the user wishes to revoke access, they can remove the virtual key from the Locks screen.

Setup Steps
Creating a Key Pair

To create a private key, run:

openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem

Then, generate the associated public key.

openssl ec -in private-key.pem -pubout -out public-key.pem

Note: the vehicle only supports prime256v1 keys.

Hosting the Public Key

This public key must remain available at:

https://developer-domain.com/.well-known/appspecific/com.tesla.3p.public-key.pem

Note: private-key.pem needs to be kept secret and should never be hosted on a domain.

After the public key is publicly accessible, call the Partner Account register endpoint to enroll this key with Tesla.

Adding to a Vehicle

Applications will have their virtual key added automatically to vehicles purchased through the B2B program. Note: these vehicles must have fewer than 20 paired keys and must not require the vehicle command protocol; both of these states are present on the fleet_status endpoint. Vehicles purchased outside the B2B program do not allow Tesla to remotely add keys. For these cases, the virtual key must be added by a user with vehicle access.

To request virtual key pairing via the Tesla mobile app:

Ensure the user has authorized the application and granted the vehicle_device_data, vehicle_cmds, or vehicle_location scopes.
Direct the user to the key pairing deep link with the Application's domain:
https://tesla.com/_ak/*developer-domain.com*

Users with multiple vehicles can select the vehicle before opening the key paring link, or an optional vin parameter can be added:

https://tesla.com/_ak/*developer-domain.com*?vin=VIN123

Removing Key

To remove a key, the user must navigate to the Locks screen in the vehicle and delete the key. Access can also be revoked remotely by revoking the third-party application's access.

Terminology
Virtual key: A virtual key is a public/private key pair used by a developer application to securely communicate with a vehicle.
Public key: A cryptographic key used by the vehicle to validate a payload comes from a trusted source.
Private key: A cryptographic key used by the Vehicle Command Proxy to sign payloads sent to the vehicle. The private key must be kept secret to prevent unauthorized access to the vehicle.
Signed commands: A signed command is a command (such as unlock door) which is signed by the application's private key. The easiest method to sign commands is through the Vehicle Command Proxy.
