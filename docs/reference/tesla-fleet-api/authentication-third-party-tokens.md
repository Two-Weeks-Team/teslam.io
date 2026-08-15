<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Third-Party Tokens

> **Source** <https://developer.tesla.com/docs/fleet-api/authentication/third-party-tokens>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Third-Party Tokens

Use the authorization_code grant flow to generate a token on behalf of a customer. This allows API calls using the scopes granted by the customer. Authentication endpoints are not billed.

Step 1: User Authorization

To initiate the authorization code flow, direct the customer to an /authorize request.

https://auth.tesla.com/oauth2/v3/authorize

Parameters
Name	Required	Example	Description
response_type	Yes	code	A string, always use the value "code".
client_id	Yes	abc-123	Partner application client ID.
redirect_uri	Yes	https://example.com/auth/callback	Partner application callback url, spec: rfc6749.
scope	Yes	openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds	Space delimited list of scopes, include openid and offline_access to obtain a refresh token.
state	Yes	db4af3f87...	Random value used for validation.
nonce	No	7baf90cda...	Random value used for replay prevention.
prompt_missing_scopes	No	true or false	When true, the user will be prompted to authorize scopes, if they have not already granted all required scopes.
require_requested_scopes	No	true or false	When true, the user must authorize all requested scopes to proceed.
show_keypair_step	No	true or false	Inform users there will be a second step in the authorization flow for virtual key pairing. This is meant to be used for cases where an application immediately redirects users to virtual key paring after receiving the authorization code callback.
Example Request
https://auth.tesla.com/oauth2/v3/authorize?&client_id=$CLIENT_ID&locale=en-US&prompt=login&redirect_uri=$REDIRECT_URI&response_type=code&scope=openid%20vehicle_device_data%20offline_access&state=$STATE

Step 2: Callback

After the user authorizes their account with Tesla, they will be redirected to the specified redirect_uri.

Extract the code URL parameter from this callback.

Step 3: Code Exchange

Execute a code exchange call to generate a token. The access_token can be used for subsequent requests to Fleet API on behalf of the user.

If using the offline_access scope, save the refresh_token to generate tokens in the future. The refresh token is single use only and expires after 3 months.

An invalid_auth_code response likely means the code is expired.

Important: calls to /token must use the fleet-auth.prd.vn.cloud.tesla.com domain as these calls can come from application servers and require different rate limits.

POST https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token

Parameters
Name	Required	Example	Description
grant_type	Yes	authorization_code	Grant type must be authorization_code.
client_id	Yes	abc-123	Partner application client ID.
client_secret	Yes	secret-password	Partner application client secret.
audience	Yes	https://fleet-api.prd.na.vn.cloud.tesla.com	Audience for the generated token. Must be a Fleet API base URL.
redirect_uri	Yes	https://example.com/auth/callback	Partner application callback url, spec: rfc6749.
scope	No	openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds	Space-delimited list of scopes.
Example Request
# Authorization code token request
CODE=<extract from callback>
curl --request POST \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET" \
  --data-urlencode "code=$CODE" \
  --data-urlencode "audience=$AUDIENCE" \
  --data-urlencode "redirect_uri=$CALLBACK" \
  'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'
# Extract access_token and refresh_token from this response

Refresh Tokens

Use the refresh token to generate a new access token and refresh token. When exchanging a refresh token, ensure the new refresh token is saved for use on the next exchange. To support cases where applications fail to save a new refresh token, the most recently used refresh token is valid for up to 24 hours.

There are two common failure modes for refresh token exchange that return a 401 - login_required response:

The refresh token is expired or has been cycled out by newer refresh tokens.
The user has reset their password.
Parameters
Name	Required	Example	Description
grant_type	Yes	refresh_token	Grant type must be refresh_token.
client_id	Yes	abc-123	Partner application client ID.
refresh_token	Yes	NA_a90869e9d...	Refresh token from the code exchange response.
Example Request
# Refresh token request
REFRESH_TOKEN=<extract from authorization code token request>
curl --request POST \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "refresh_token=$REFRESH_TOKEN" \
  'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token'

Scope Changes

Once a user has granted scopes to an application, they can modify scopes or revoke access using the consent management page:

https://auth.tesla.com/user/revoke/consent?revoke_client_id=$CLIENT_ID&back_url=$RETURN_URL

Scope modifications are compatible with existing refresh tokens and will be applied to new access tokens.

Scope additions can be made by sending the user an /authorize link with prompt_missing_scopes=true
