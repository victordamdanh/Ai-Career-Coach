import test from "node:test";
import assert from "node:assert/strict";
import { recommendCompanies, fetchListings } from "../src/listings.mjs";
import { listingWorkArrangement, matchesSearchLocation, matchesWorkArrangement } from "../web/job-preferences.mjs";

test("real board posting location shapes and title aliases survive strict guided filtering", async () => {
  const job = (id, title, location, content, extra = {}) => ({
    id, title, location: { name: location }, absolute_url: "https://job-boards.greenhouse.io/cloudflare/jobs/" + id,
    content, ...extra,
  });
  const board = {
    cloudflare: [
      job(101, "Analytics Analyst", "Hybrid", "<p>2 years of experience with analytics.</p>", {
        metadata: [{ name: "Job Posting Location", value: ["Austin, US"] }],
        offices: [{ name: "Austin, TX", location: "Austin, TX, United States" }],
      }),
      job(102, "Data Analyst", "Hybrid", "<p>Analyze customer data and prepare reports.</p>", {
        offices: [{ name: "Austin, TX", location: "Austin, TX, United States" }],
      }),
      job(103, "Senior Data Analyst", "Hybrid", "<p>Seven years of experience.</p>", {
        offices: [{ name: "Austin, TX", location: "Austin, TX, United States" }],
      }),
      job(104, "Junior Business Analyst", "Austin, TX · Hybrid", "<p>Gather business requirements.</p>"),
      job(105, "Junior Data Analyst", "Hybrid", "<p>Analyze customer data.</p>", {
        offices: [{ name: "Phoenix, AZ", location: "Phoenix, AZ, United States" }],
      }),
    ],
    figma: [
      job(201, "Junior Data Analyst", "San Francisco, CA • New York, NY • United States", "<p>This role may be held at our US hubs (in office 2 days/week) or remotely in the United States.</p>"),
    ],
    stripe: [
      job(301, "Junior Data Analyst", "Austin, TX · Hybrid", undefined),
    ],
    reddit: [
      job(401, "Senior Marketing Manager", "Austin, TX · Hybrid", "<p>Marketing campaigns.</p>"),
    ],
  };
  const detailsRequests = [];
  const fetcher = async input => {
    const url = new URL(input);
    const company = url.pathname.split("/")[3];
    const records = board[company] || [];
    if (url.searchParams.has("content")) {
      detailsRequests.push(company);
      if (company === "stripe") return new Response(null, { status: 503 });
      return Response.json({ jobs: records });
    }
    return Response.json({ jobs: records.map(({content, offices, ...summary}) => summary) });
  };
  const context = { roles: ["Data Analyst"], place: "Texas", level: "Entry level", strict: true, skills: ["SQL"], includeRemote: false };
  const hybrid = await recommendCompanies({ ...context, work: "Hybrid" }, fetcher);
  const ids = result => result.matches.flatMap(group => group.jobs.map(posting => posting.id)).sort((a,b) => a-b);
  assert.deepEqual(ids(hybrid), [101,102,301]);
  assert.deepEqual(hybrid.relaxed, []);
  assert.deepEqual(hybrid.incomplete, ["Stripe"]);
  assert.ok(!detailsRequests.includes("reddit"), "Skip large content requests on irrelevant boards");
  const uncertain = hybrid.matches.flatMap(group => group.jobs).find(posting => posting.id === 102);
  assert.equal(uncertain.levelUnverified, true);
  assert.match(uncertain.location, /Austin, TX/);
  const known = hybrid.matches.flatMap(group => group.jobs).find(posting => posting.id === 101);
  assert.equal(known.levelUnverified, false);
  const remote = await recommendCompanies({ ...context, place: "Arizona", work: "Remote" }, fetcher);
  assert.deepEqual(ids(remote), [201]);
  assert.deepEqual(remote.relaxed, []);
  const single = await fetchListings("cloudflare", "Data Analyst", fetcher, { place: "Texas", work: "Hybrid", level: "Entry level" });
  assert.deepEqual(single.jobs.map(posting => posting.id), [102]);
});

test("multi-arrangement roles retain explicitly offered work options and state restrictions", () => {
  const dual = { title: "Data Analyst", location: "San Francisco, CA • New York, NY • United States", description: "Work from our US hubs (in office 2 days/week) or remotely in the United States." };
  assert.equal(listingWorkArrangement(dual), "Remote / Hybrid");
  assert.ok(matchesWorkArrangement("Remote", dual));
  assert.ok(matchesWorkArrangement("Hybrid", dual));
  assert.ok(matchesSearchLocation("Arizona", dual, "Remote"));
  assert.ok(!matchesSearchLocation("Arizona", dual, "Hybrid"));
  assert.ok(!matchesSearchLocation("Arizona", {title: "Data Analyst", location:"Remote, California, United States"}, "Remote"));
  assert.equal(listingWorkArrangement({title:"Hybrid Cloud Engineer", location:"Phoenix, AZ"}), "");
});
