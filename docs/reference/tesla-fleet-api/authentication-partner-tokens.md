<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Partner Tokens

> **Source** <https://developer.tesla.com/docs/fleet-api/authentication/partner-tokens>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Partner Tokens

POST https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token

Generates a token to be used for managing a partner's account or devices they own. Authentication endpoints are not billed.

Parameters
Name	Required	Example	Description
grant_type	Yes	client_credentials	Grant type must be client_credentials.
client_id	Yes	abc-123	Partner application client ID.
client_secret	Yes	secret-password	Partner application client secret.
audience	Yes	https://fleet-api.prd.na.vn.cloud.tesla.com	Audience for the generated token. Must be a Fleet API base URL
scope	No	openid user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds vehicle_specs vehicle_pricing_info	Space-delimited list of scopes.
Example Request
CLIENT_ID=<command to obtain a client_id>
CLIENT_SECRET=<secure command to obtain a client_secret>
AUDIENCE="https://fleet-api.prd.na.vn.cloud.tesla.com"
# Partner authentication token request
curl --request POST \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET" \
  --data-urlencode 'scope=openid vehicle_device_data vehicle_cmds vehicle_charging_cmds' \
  --data-urlencode "audience=$AUDIENCE" \
  'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'
