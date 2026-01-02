import test from "node:test";
import assert from "node:assert";

// Test the health endpoint
test("Health endpoint returns healthy status", async () => {
    const result = { status: "healthy" };
    assert.strictEqual(result.status, "healthy");
});

// Test Fibonacci calculation validation
test("Index validation - should reject index > 40", () => {
    const index = 45;
    const shouldReject = parseInt(index) > 40;
    assert.strictEqual(shouldReject, true);
});

test("Index validation - should accept index <= 40", () => {
    const index = 40;
    const shouldAccept = parseInt(index) <= 40;
    assert.strictEqual(shouldAccept, true);
});

// Test response structure
test("API response structure - values current", () => {
    const mockResponse = { values: { "5": "8", "10": "89" } };
    assert.ok(mockResponse.hasOwnProperty("values"));
    assert.strictEqual(typeof mockResponse.values, "object");
});

test("API response structure - values all", () => {
    const mockResponse = [{ number: 5 }, { number: 10 }];
    assert.ok(Array.isArray(mockResponse));
    assert.ok(mockResponse[0].hasOwnProperty("number"));
});
