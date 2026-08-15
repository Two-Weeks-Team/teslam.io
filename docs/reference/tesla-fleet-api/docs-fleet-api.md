<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# What is Fleet API?

> **Source** <https://developer.tesla.com/docs/fleet-api/getting-started/what-is-fleet-api>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

What is Fleet API?

Fleet API is a data and command service providing access to Tesla vehicles and energy devices. Partners can interact with their own devices or devices for which they have been granted access by a customer.

Follow the onboarding process below to register and get an API key to interact with Tesla's API endpoints. Applications can request vehicle owners for permission to view account information, get vehicle status or even issue remote commands. Vehicle owners maintain control over which application they grant access to, and can change these settings at any time.

Step 1: Create a Tesla Account

Create a Tesla account and ensure it has a verified email and multi-factor authentication enabled.

Create Account
Step 2: Create an Application

Click the button below to request app access. Provide legal business details, application name, description, and purpose of usage.

While requesting access, select the scopes used by the application. Reference the authentication overview page for a list of available scopes.

Note: account creation requests can be automatically rejected if the application name already exists.

Create Application and Access Dashboard
Step 3: Generate a Public/Private Key Pair

A public key must be hosted on the application's domain before making calls to Fleet API.

The key is used to validate ownership of the domain and provide additional security when using Vehicle Commands and Fleet Telemetry.

To create a private key, run:

openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem

Then, generate the associated public key.

openssl ec -in private-key.pem -pubout -out public-key.pem

This public key should be available at:

https://developer-domain.com/.well-known/appspecific/com.tesla.3p.public-key.pem

Note: private-key.pem needs to be kept secret and should not be hosted on a domain.

Step 4: Call the Register Endpoint

Next, generate a partner authentication token and use it to call the register endpoint to complete registration with Fleet API. Note: The register call needs to be completed in each region of operation.

Next Steps

Now that the register endpoint has been called, Fleet API is configured and ready to receive requests.

Next steps to take:

Selecting the proper authentication token type and generating tokens. Authentication overview.
Pairing a public key to a vehicle. This is required to send Vehicle Commands and setup Fleet Telemetry.
Configuring Fleet Telemetry which streams data directly to a server.
