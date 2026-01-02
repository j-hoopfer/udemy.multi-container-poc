import test from "node:test";
import assert from "node:assert";

// Fibonacci function test (extracted from main worker logic)
function fib(n) {
    if (n < 2) {
        return 1;
    }
    return fib(n - 1) + fib(n - 2);
}

test("Fibonacci calculation - base cases", () => {
    assert.strictEqual(fib(0), 1);
    assert.strictEqual(fib(1), 1);
});

test("Fibonacci calculation - small numbers", () => {
    assert.strictEqual(fib(2), 2);
    assert.strictEqual(fib(3), 3);
    assert.strictEqual(fib(4), 5);
    assert.strictEqual(fib(5), 8);
});

test("Fibonacci calculation - larger numbers", () => {
    assert.strictEqual(fib(10), 89);
    assert.strictEqual(fib(15), 987);
});

test("Fibonacci calculation - verify sequence", () => {
    const expected = [1, 1, 2, 3, 5, 8, 13, 21];
    for (let i = 0; i < expected.length; i++) {
        assert.strictEqual(fib(i), expected[i], `fib(${i}) should equal ${expected[i]}`);
    }
});

test("Message parsing - convert string to integer", () => {
    const message = "5";
    const index = parseInt(message, 10);
    assert.strictEqual(index, 5);
    assert.strictEqual(typeof index, "number");
});
