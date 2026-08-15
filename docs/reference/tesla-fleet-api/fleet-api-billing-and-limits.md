<!-- Captured verbatim from Tesla's documentation. Do not edit the body:
     if it is wrong, the fix is to re-capture, not to correct it here. -->

# Billing and Limits

> **Source** <https://developer.tesla.com/docs/fleet-api/billing-and-limits>  
> **Captured** 2026-08-15 via headless Chrome — `developer.tesla.com` returns 403 to
> plain HTTP fetchers, so this is what a real browser rendered.

---

Billing and Limits

Fleet API is available through a pay-per-use pricing model which charges incrementally based on usage. The home page contains high level pricing details.

What developers need to know:

Applications that exceed their billing limit or do not have a configured payment method will be automatically disabled.
Billing cycles are monthly and begin on the first day of the month.
At the end of a billing cycle bills are due and an invoice will be available in the developer portal. The payment method on file will be automatically charged 14 days after the end of the month.
Billing reminder emails will be sent once a bill is due. After 30 days of no payment, Tesla reserves the right to disable API access, as outlined in the Fleet API agreement.
A monthly discount of $10 is provided to support individual developers/small applications.
All requests with a status codes below 500 are counted as billable usage. Status code 500 and above are not billed.
Each request or signal in the pricing categories will be charged at the rate indicated. Charges will be rounded to the nearest $0.01. For example, using 1,211 commands will incur a charge of $1.21.
Each endpoint's pricing category is available in the API documentation. Click the + icon to expand the endpoint's details and view the "Pricing Category" section.

Pricing category shown on each endpoint.

Excessive Bill Protection

By default, each account has a billing limit of 0. This limit can be increased once a payment method is added to the account. It is recommended to configure a billing limit to prevent unexpected bills. Current usage is available on the billing and usage page of the application management dashboard.

An email notification will be sent when 80% of the billing limit has been reached. Another email will be sent when the limit has been reached.

Billing Limit Exceeded:

If the billing limit is exceeded, API usage will be suspended and any vehicles configured for Fleet Telemetry will have their streaming configurations removed. Access will be re-enabled once the billing limit is raised or a new billing cycle begins. ⚠️ Fleet Telemetry configurations will not be restored. ⚠️

Application access will not be disabled during the payment transition period which ends February 1, 2024. To ensure uninterrupted API access, configure a payment method and billing limit prior to this date.

To configure a payment method, navigate to the billing and usage page of the application management dashboard and select "Manage Payment".

To set a billing limit, navigate to the billing and usage page of the application management dashboard and select "Update Limit". Note that actual usage may be slightly higher than the billing limit, but pre-tax bills will be capped at the limit.

Rate Limits

Fleet API has rate limits in place to prevent excessive usage. Applications should not reach these limits under typical operation.

The limits are tracked per device, per account:

Realtime Data: 60 requests per minute
Wakes: 3 requests per minute
Device Commands: 30 requests per minute

An account can have multiple developer applications. If an account has multiple developer applications interacting with the same vehicle, these limits are shared.

Cost Optimization

Applications are recommended to take the following actions to reduce billable events.

In most cases, frequently waking vehicles is a sign of improper application design.
Ensure the vehicle is online before requesting device data or sending commands. Connectivity state can be monitored through Fleet Telemetry (preferred) or the vehicle endpoint.
Analyze the response of signed commands and act on errors before resending any commands. For example, if the response states the virtual key is not present on the vehicle, add the key to the vehicle before retrying.
Migrate from polling the vehicle_data endpoint to using Fleet Telemetry.
Utilize the minimum_delta configuration option for numeric fields in fleet-telemetry. See the announcement.

Migrating to Fleet Telemetry offers a number of benefits.

Applications only receive the data they are interested in.
Vehicles automatically send data when they are awake and connected to the internet.
Signals are only sent when their value changes, meaning applications are not incurring charges for fields that are not changing. With vehicle data, an application must continually poll for data.
Data is available at high frequency with low latency.

Note: Pre-2018 Model S and Model X vehicles without an infotainment upgrade do not support Fleet Telemetry. Support is not planned for these vehicles.

Cost Optimization Case Studies

The pricing structure heavily incentivises development practices that improve customer experience and vehicle efficiency. Here are real-world examples of cost optimisations for applications using Fleet API. These optimizations offered comparable functionality.

Popular Consumer App Optimization: 97% Cost Reduction

In a test session lasting 30 minutes, the application was in the foreground and actively used for 15 minutes. Throughout the session, the user sent four commands and clicked around in the app.

Count of billable events:

Device Data: 384 requests
Commands: 4 requests
Wakes: 4 requests
Streaming Signals: 0 signals

The total cost of this session, before optimization, is $0.852.

After migrating to Fleet Telemetry and optimizing application logic, the billable events could be reduced to:

Device Data: 0 requests (Fleet Telemetry is used for gathering realtime data and validating command execution)
Commands: 4 requests (commands cannot be reduced)
Wakes: 1 request (the vehicle was online for each command after the first one. See monitoring vehicle connectivity state)
Streaming Signals: 300 signals (introduced to eliminate the need for Device Data polling)

The cost of this session, after optimization, is $0.026. This is a cost reduction of 97%.

Fleet Management Optimization: 94% Cost Reduction

A business with a large fleet of vehicles streams 70 signals. The data collection interval per field ranges from 60 seconds to 10 minutes, resulting in approximately 1000 signals streamed per hour. This equates to a cost of $0.00667 per hour per car via Fleet Telemetry.

Receiving the same information via vehicle_data yields a cost of $0.12 per hour. This is a cost reduction of 94%!
