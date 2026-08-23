# OPIS Product Requirements for DriveDrop

Status: OPISNAVX dataset inquiry submitted successfully on 2026-08-23. Awaiting an OPIS representative, commercial terms, API documentation, and credentials.

## Verified from indexed OPIS results

- The relevant product family is **OPIS Retail Fuel Prices**, not OPIS Spot API or OPIS Rack API.
- OPIS states that it provides retail diesel prices at more than 6,000 truck stops across the U.S. and Canada.
- OPIS offers a free trial or demo for its retail-pricing products.
- The **Truckstop Spread Report** contains daily retail diesel prices, costs, and calculated margins. It is a report product and is not sufficient evidence of an application API.
- The **Retail Radius Report** provides retail gas and diesel prices within a selected 2-, 5-, or 10-mile radius. Its application-integration delivery method still needs verification.

## Verified from the official OPISNAVX page

- OPISNAVX is the correct product for providing drivers with en-route gas-station prices and locations.
- OPIS states that the service supplies real-time data to connected-car and mobile-navigation users.
- Its station database covers 400,000 gas stations across 60 countries.
- Station attributes include brand, name, address, exact coordinates, opening hours, phone number, and fuel types.
- OPIS processes more than two million gas-station price updates daily.
- Delivery options include APIs, bulk files, and geographic requests.

## Inquiry submission

- Product: OPISNAVX
- Organization: DriveDrop
- Business classification: Consumer-Facing Application
- Request type: Inquire about datasets
- Country: United States
- Marketing opt-in: No
- HubSpot form submission: HTTP 200
- Confirmation: Official OPISNAVX thank-you page displayed and stated that a representative will make contact.

## Interim production hierarchy

While OPISNAVX access is pending, DriveDrop uses the following evidence order:

1. Google Places station-level diesel price near the route origin, when a valid price and observation timestamp are available.
2. EIA weekly U.S. on-highway diesel benchmark when Google has no station diesel price.
3. Existing modeled regional fuel price remains the route-cost planning estimate when neither provider is available.

Live validation on 2026-08-23 confirmed that both configured APIs returned HTTP 200. Google Places returned nearby stations but no diesel price records for the Charlotte probe, and the service correctly selected the EIA observation published for 2026-08-17. Station-level and national evidence must remain visibly distinguished in the product.

## Required OPIS confirmation

DriveDrop needs an OPIS retail product or feed that provides:

- Station or truck-stop identifier, name, address, latitude, and longitude
- Retail diesel price per gallon
- Provider observation or update timestamp per price
- U.S. coverage, with truck-stop coverage explicitly included
- API or machine-readable feed access suitable for production route planning
- Authentication method, response schema, rate limits, and freshness SLA
- Commercial display, attribution, caching, and retention rights
- Sandbox or trial credentials and production pricing

Do not purchase Spot API, Rack API, Truckstop Spread Report, or Retail Radius Report unless OPIS confirms that the product includes the machine-readable station-level retail diesel feed required above.

## Integration gate

Do not set `OPIS_ENABLED=true` until OPIS supplies credentials, endpoint documentation, licensed fields, and confirmed display/caching rights. The current backend OPIS code is an availability placeholder, not a functioning adapter.
