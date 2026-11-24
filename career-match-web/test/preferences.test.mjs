import assert from "node:assert/strict";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { matchesAdvertisedPay, matchesJobLevel, matchesJobLocation, salaryTarget, states } from "../web/job-preferences.mjs";
import { catalog } from "../web/preference-catalog.mjs";

test("the loaded catalog includes reported jobs, states and searchable census places", () => {
  const [titles, places] = JSON.parse(gunzipSync(Buffer.from(catalog, "base64")));
  assert.ok(titles.length > 7000);
  assert.ok(titles.includes("Claims Adjuster"));
  assert.equal(Object.keys(states).length, 52);
  assert.ok(places.length > 32000);
  for (const place of ["Tucson, AZ", "Bozeman, MT", "New York, NY", "Washington, DC"]) assert.ok(places.includes(place), place);
});

test("typed and preset work preferences match the same published values", () => {
  assert.equal(matchesJobLevel("entry", "New Grad Software Engineer"), true);
  assert.equal(matchesJobLevel("Entry level", "New Grad Software Engineer"), true);
  assert.equal(matchesJobLevel("full time", "Full-Time Analyst"), true);
  assert.equal(matchesJobLevel("Six-month rotation", "Six-Month Rotation Analyst"), true);
  assert.equal(matchesJobLevel("Part-time", "Full-Time Analyst"), false);

  assert.equal(matchesJobLocation("Arizona", "Phoenix, AZ"), true);
  assert.equal(matchesJobLocation("Phoenix, AZ", "Phoenix, Arizona"), true);
  assert.equal(matchesJobLocation("Phoenix, Arizona", "Phoenix, AZ"), true);
  assert.equal(matchesJobLocation("Portland, ME", "Portland, OR"), false);
  assert.equal(matchesJobLocation("Montréal, Canada", "Montreal, Québec, Canada"), true);
  assert.equal(matchesJobLocation("Portland, ME", "Portland, OR; Augusta, ME"), false);
  assert.equal(matchesJobLocation("Washington", "Washington, D.C."), false);
  assert.equal(matchesJobLocation("New York, NY", "New York City, New York"), true);
  assert.equal(matchesJobLocation("Remote, USA", "Remote - United States"), true);
  assert.equal(matchesJobLocation("Remote, USA", "Remote - Brazil"), false);
  assert.equal(matchesJobLocation("Arizona or Remote", "Remote - USA"), true);
});

test("custom and preset salaries compare equivalent published pay without excluding unknown pay", () => {
  const target = salaryTarget("$85k–$115k");
  assert.deepEqual(target, { min: 85000, max: 115000, unit: "yearly" });
  assert.deepEqual(salaryTarget("$20–$29 per hour"), { min: 20, max: 29, unit: "hourly" });
  assert.deepEqual(salaryTarget("Under $40,000"), { min: 0, max: 40000, unit: "yearly" });
  assert.equal(matchesAdvertisedPay(target, { min: 80000, max: 90000, unit: "yearly", currency: "USD" }), true);
  assert.equal(matchesAdvertisedPay(target, { min: 120000, max: 140000, unit: "yearly", currency: "USD" }), false);
  assert.equal(matchesAdvertisedPay(target, undefined), true);
});
