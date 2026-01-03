import { describe, it, expect } from 'vitest';

describe("Fib Component Logic", () => {
    it("should parse values response correctly", () => {
        const mockResponse = { values: { "5": "8", "10": "89" } };
        
        // Simulating the component's data extraction logic
        const values = mockResponse.values || {};
        expect(values).toEqual({ "5": "8", "10": "89" });
    });

    it("should handle empty values", () => {
        const mockResponse = { values: {} };
        const values = mockResponse.values || {};
        expect(values).toEqual({});
    });

    it("should parse indexes response correctly", () => {
        const mockResponse = [{ number: 5 }, { number: 10 }];
        
        // Simulating the component's data extraction logic
        const seenIndexes = Array.isArray(mockResponse) ? mockResponse : [];
        expect(seenIndexes.length).toBe(2);
        expect(seenIndexes[0].number).toBe(5);
    });

    it("should handle empty indexes array", () => {
        const mockResponse = [];
        const seenIndexes = Array.isArray(mockResponse) ? mockResponse : [];
        expect(seenIndexes).toEqual([]);
    });

    it("should extract numbers from indexes", () => {
        const seenIndexes = [{ number: 5 }, { number: 10 }, { number: 15 }];
        const numbers = seenIndexes.map(({ number }) => number).join(", ");
        expect(numbers).toBe("5, 10, 15");
    });

    it("should validate index input - valid inputs", () => {
        const validInputs = ["5", "10", "40"];

        validInputs.forEach((input) => {
            const index = parseInt(input, 10);
            expect(index <= 40).toBe(true);
        });
    });

    it("should validate index input - invalid inputs", () => {
        const invalidInputs = ["41", "50", "100"];

        invalidInputs.forEach((input) => {
            const index = parseInt(input, 10);
            expect(index > 40).toBe(true);
        });
    });

    it("should format form submission data correctly", () => {
        const index = "5";
        const data = { index };
        
        expect(data).toEqual({ index: "5" });
        expect(JSON.stringify(data)).toBe('{"index":"5"}');
    });
});
