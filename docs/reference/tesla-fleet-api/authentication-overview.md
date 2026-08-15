<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Authentication

> **Source** <https://developer.tesla.com/docs/fleet-api/authentication/overview>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Authentication

API endpoints require an authentication token. It must be included as a header:

Authorization: Bearer <token>

Token Types

There are three token types meant for different use cases.

Third-party token: A token representing a third-party application accessing the API or products on behalf of a person. Examples:
A third-party developer building a mobile app or service that interacts with a vehicle or powerwall owned by a person.
A hobbyists building an integration with their own Tesla product.
Partner token: A token representing an application or business. Examples:
A businesses automating interactions with their own fleet of vehicles. -- Businesses can self-onboard to Tesla for Business by visiting the self-onboarding page.
A developer making configuration changes to their own application.
All calls to Partner Endpoints.
Third-party for Business token: A token representing a third-party application accessing the API or products on behalf of a business.
A developer building a fleet management tool used by a business that owns many vehicles.
Scopes

Scopes are used to limit API access to only the data an application needs.

Name	Scope	Description
Sign in with Tesla	openid	Allow Tesla customers to sign in to the application with their Tesla credentials.
Refresh Tokens	offline_access	Allow getting a refresh token without needing user to log in again.
Profile Information	user_data	Contact information, home address, profile picture, and referral information.
Vehicle Information	vehicle_device_data	Allow access to your vehicle’s live data, service history, service scheduling data, service communications, eligible upgrades, nearby Superchargers and ownership details.
Vehicle Location	vehicle_location	Allow access to vehicle location information, including data such as precise location, and coarse location for approximate location services.
Vehicle Commands	vehicle_cmds	Commands like add/remove driver, access Live Camera, unlock, wake up, remote start, and schedule software updates.
Vehicle Charging Management	vehicle_charging_cmds	Vehicle charging history, billed amount, charging location, commands to schedule, and start/stop charging.
Vehicle Specs	vehicle_specs	Access detailed vehicle specifications. This scope can only be used by Partner Tokens and can be used for any vehicle without owner authorization.
Vehicle Pricing Information	vehicle_pricing_info	Access vehicle pricing details including configuration options, fees, and specifications for a given market and model. This scope can only be used by Partner Tokens.
Energy Product Information	energy_device_data	Energy live status, site info, backup history, energy history, and charge history.
Energy Product Settings	energy_cmds	Update settings like backup reserve percent, operation mode, and storm mode.
Enterprise Management	enterprise_management	Allow access to enterprise management functions for businesses.
Useful Links

The OAuth server's metadata file can be found at: https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/thirdparty/.well-known/openid-configuration.

A Postman collection with these requests can be found here.
