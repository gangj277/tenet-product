import assert from "node:assert/strict";
import test from "node:test";
import {
  checkUserBudget,
  recordUserCost,
  getUserCostSnapshot,
} from "../lib/rate-limit";

// Clear the globalThis tracker before each test suite run
const g = globalThis as typeof globalThis & {
  __tenetUserCostTracker?: Map<unknown, unknown>;
};

test("checkUserBudget returns allowed for a new user", () => {
  const userId = `test-new-${Date.now()}`;
  const result = checkUserBudget(userId);

  assert.equal(result.allowed, true);
  assert.equal(result.spentUsd, 0);
  assert.equal(typeof result.limitUsd, "number");
  assert.ok(result.limitUsd > 0);
});

test("recordUserCost accumulates costs correctly", () => {
  const userId = `test-accumulate-${Date.now()}`;

  recordUserCost(userId, 1.5);
  let snap = getUserCostSnapshot(userId);
  assert.equal(snap.spentUsd, 1.5);

  recordUserCost(userId, 2.25);
  snap = getUserCostSnapshot(userId);
  assert.ok(
    Math.abs(snap.spentUsd - 3.75) < 0.001,
    `Expected ~3.75, got ${snap.spentUsd}`
  );
});

test("recordUserCost ignores zero and negative amounts", () => {
  const userId = `test-ignore-${Date.now()}`;

  recordUserCost(userId, 5.0);
  recordUserCost(userId, 0);
  recordUserCost(userId, -1.0);

  const snap = getUserCostSnapshot(userId);
  assert.equal(snap.spentUsd, 5.0);
});

test("checkUserBudget blocks when limit is reached", () => {
  const userId = `test-block-${Date.now()}`;

  // Record cost up to the limit (default $20)
  recordUserCost(userId, 20.0);

  const result = checkUserBudget(userId);
  assert.equal(result.allowed, false);
  assert.equal(result.spentUsd, 20.0);
});

test("checkUserBudget blocks when limit is exceeded", () => {
  const userId = `test-exceed-${Date.now()}`;

  recordUserCost(userId, 25.0);

  const result = checkUserBudget(userId);
  assert.equal(result.allowed, false);
  assert.ok(result.spentUsd >= 20);
});

test("getUserCostSnapshot returns today's date", () => {
  const userId = `test-date-${Date.now()}`;
  const snap = getUserCostSnapshot(userId);

  const today = new Date().toISOString().slice(0, 10);
  assert.equal(snap.date, today);
});

test("separate users have independent budgets", () => {
  const userA = `test-userA-${Date.now()}`;
  const userB = `test-userB-${Date.now()}`;

  recordUserCost(userA, 15.0);
  recordUserCost(userB, 3.0);

  const snapA = getUserCostSnapshot(userA);
  const snapB = getUserCostSnapshot(userB);

  assert.equal(snapA.spentUsd, 15.0);
  assert.equal(snapB.spentUsd, 3.0);

  assert.equal(checkUserBudget(userA).allowed, true);
  assert.equal(checkUserBudget(userB).allowed, true);

  // Push user A over
  recordUserCost(userA, 6.0);
  assert.equal(checkUserBudget(userA).allowed, false);
  assert.equal(checkUserBudget(userB).allowed, true);
});

test("globalThis singleton survives re-import", async () => {
  const userId = `test-singleton-${Date.now()}`;

  recordUserCost(userId, 7.77);

  // Dynamic re-import (tsx caches, but the globalThis singleton should persist)
  const freshModule = await import("../lib/rate-limit");
  const snap = freshModule.getUserCostSnapshot(userId);

  assert.ok(
    Math.abs(snap.spentUsd - 7.77) < 0.001,
    `Expected ~7.77 after re-import, got ${snap.spentUsd}`
  );
});

test("budget allows spending just below the limit", () => {
  const userId = `test-justbelow-${Date.now()}`;

  recordUserCost(userId, 19.99);
  const result = checkUserBudget(userId);

  assert.equal(result.allowed, true);
  assert.ok(
    Math.abs(result.spentUsd - 19.99) < 0.001,
    `Expected ~19.99, got ${result.spentUsd}`
  );
});

test("multiple small costs accumulate to block", () => {
  const userId = `test-smallcosts-${Date.now()}`;

  // Record 200 costs of $0.10 each = $20
  for (let i = 0; i < 200; i++) {
    recordUserCost(userId, 0.1);
  }

  const result = checkUserBudget(userId);
  assert.equal(result.allowed, false);
  // Allow floating point imprecision
  assert.ok(
    Math.abs(result.spentUsd - 20.0) < 0.01,
    `Expected ~20.0, got ${result.spentUsd}`
  );
});
