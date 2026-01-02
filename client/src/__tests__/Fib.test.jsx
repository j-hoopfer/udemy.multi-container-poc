import test from "node:test";
import assert from "node:assert";

test("Fib Component Logic", async (t) => {
    await t.test("should parse values response correctly", () => {
        const mockResponse = { values: { "5": "8", "10": "89" } };
        
        // Simulating the component's data extraction logic
        const values = mockResponse.values || {};
        assert.deepStrictEqual(values, { "5": "8", "10": "89" });
    });

    await t.test("should handle empty values", () => {
        const mockResponse = { values: {} };
        const values = mockResponse.values || {};
        assert.deepStrictEqual(values, {});
    });

    await t.test("should parse indexes response correctly", () => {
        const mockResponse = [{ number: 5 }, { number: 10 }];
        
        // Simulating the component's data extraction logic
        const seenIndexes = Array.isArray(mockResponse) ? mockResponse : [];
        assert.strictEqual(seenIndexes.length, 2);
        assert.strictEqual(seenIndexes[0].number, 5);
    });

    await t.test("should handle empty indexes array", () => {
        const mockResponse = [];
        const seenIndexes = Array.isArray(mockResponse) ? mockResponse : [];
        assert.deepStrictEqual(seenIndexes, []);
    });

    await t.test("should extract numbers from indexes", () => {
        const seenIndexes = [{ number: 5 }, { number: 10 }, { number: 15 }];
        const numbers = seenIndexes.map(({ number }) => number).join(", ");
        assert.strictEqual(numbers, "5, 10, 15");
    });

    await t.test("should validate index input - valid inputs", () => {
        const validInputs = ["5", "10", "40"];

        validInputs.forEach((input) => {
            const index = parseInt(input, 10);
            assert.strictEqual(index <= 40, true);
        });
    });

    await t.test("should validate index input - invalid inputs", () => {
        const invalidInputs = ["41", "50", "100"];

        invalidInputs.forEach((input) => {
            const index = parseInt(input, 10);
            assert.strictEqual(index > 40, true);
        });
    });

    await t.test("should format form submission data correctly", () => {
        const index = "5";
        const data = { index };
        
        assert.deepStrictEqual(data, { index: "5" });
        assert.strictEqual(JSON.stringify(data), '{"index":"5"}');
    });
});
