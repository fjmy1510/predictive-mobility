"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { initialState, transition, demandStatus, can } = require("../demo-state.js");

test("需要ステータス：全境界と範囲外の確率", () => {
  for (const [probability, expected] of [[0, "LOW"], [49, "LOW"], [50, "DETECTED"], [69, "DETECTED"], [70, "POSITIONING"], [89, "POSITIONING"], [90, "PREPARED"], [94, "PREPARED"], [95, "CONFIRMED"], [100, "CONFIRMED"]]) {
    assert.equal(demandStatus(probability), expected);
  }
  for (const invalid of [-1, 101, 82.5, NaN, undefined, "82"]) assert.throws(() => demandStatus(invalid), RangeError);
});

test("5状態を通り、需要確定まで車両を利用者に割り当てない", () => {
  let state = initialState();
  const phases = [state.demoPhase];
  assert.equal(state.prediction.probability, 0);
  assert.equal(state.prediction.status, "LOW");
  assert.equal(state.vehicle.status, "AVAILABLE");
  for (const [event, phase, probability, vehicleStatus, location] of [
    ["PREDICT", "PREDICTED", 82, "AVAILABLE", "DEPOT"],
    ["START_POSITIONING", "POSITIONING", 82, "POSITIONING", "AREA_A_NEAR_HOME"],
    ["FINISH_MOVEMENT", "POSITIONING", 82, "POSITIONING", "AREA_A_NEAR_HOME"],
    ["DETECT_MOVEMENT", "CONFIRMED", 98, "POSITIONING", "AREA_A_NEAR_HOME"],
  ]) {
    state = transition(state, event);
    assert.equal(state.demoPhase, phase);
    assert.equal(state.prediction.probability, probability);
    assert.equal(state.vehicle.status, vehicleStatus);
    assert.equal(state.vehicle.location, location);
    assert.equal(state.vehicle.assignedUserId, null);
    assert.equal(state.arrived, false);
    if (phases.at(-1) !== phase) phases.push(phase);
  }
  assert.equal(state.prediction.status, "CONFIRMED");
  assert.equal(state.prediction.predictedDeparture, "09:28");
  state = transition(state, "ASSIGN");
  phases.push(state.demoPhase);
  assert.equal(state.vehicle.assignedUserId, "user-01");
  assert.equal(state.vehicle.status, "ASSIGNED");
  assert.equal(state.vehicle.location, "USER_PICKUP");
  assert.equal(state.arrived, false);
  state = transition(state, "FINISH_MOVEMENT");
  assert.equal(state.arrived, true);
  assert.equal(state.demoPhase, "ASSIGNED");
  assert.equal(state.prediction.probability, 98);
  assert.equal(state.prediction.status, "CONFIRMED");
  assert.deepEqual(phases, ["INITIAL", "PREDICTED", "POSITIONING", "CONFIRMED", "ASSIGNED"]);
  assert.equal(state.logs.length, 8);
  assert.equal(new Set(state.logs.map((log) => log.id)).size, 8);
});

test("移動中、連打、不正順序の操作は状態もログも変更しない", () => {
  const events = ["PREDICT", "START_POSITIONING", "DETECT_MOVEMENT", "ASSIGN", "FINISH_MOVEMENT", "UNKNOWN"];
  let state = initialState();
  const steps = ["PREDICT", "START_POSITIONING", "FINISH_MOVEMENT", "DETECT_MOVEMENT", "ASSIGN", "FINISH_MOVEMENT"];
  for (const next of [...steps, null]) {
    for (const event of events) if (!can(state, event)) assert.strictEqual(transition(state, event), state);
    if (next) {
      const before = structuredClone(state);
      const previous = state;
      state = transition(state, next);
      assert.deepEqual(previous, before, "更新前の状態を変更しない");
      assert.strictEqual(transition(state, next), state, "同じイベントの再実行を無視する");
    }
  }
});

test("全イベント列を探索しても割り当て条件と演出の完了順を破らない", () => {
  let frontier = [initialState()];
  const visited = new Set();
  while (frontier.length) {
    const state = frontier.pop();
    const key = JSON.stringify(state);
    if (visited.has(key)) continue;
    visited.add(key);
    assert.equal(state.vehicle.assignedUserId !== null, state.demoPhase === "ASSIGNED");
    if (state.arrived) assert.ok(state.demoPhase === "ASSIGNED" && !state.moving);
    if (state.moving) assert.ok(!can(state, "DETECT_MOVEMENT") && !can(state, "ASSIGN"));
    assert.ok(state.logs.length <= 8);
    for (const event of ["PREDICT", "START_POSITIONING", "FINISH_MOVEMENT", "DETECT_MOVEMENT", "ASSIGN"]) frontier.push(transition(state, event));
  }
  assert.equal(visited.size, 7);
});

test("需要は予測配置時点の1.82を保持し、98%で二重計上しない", () => {
  let state = transition(initialState(), "PREDICT");
  const snapshot = state.demandSnapshot;
  assert.equal(snapshot.total, 1.82);
  assert.equal(snapshot.reservationCount, 1);
  assert.equal(snapshot.predictionCount, 1);
  assert.equal(state.prediction.reason.length, 3);
  for (const event of ["START_POSITIONING", "FINISH_MOVEMENT", "DETECT_MOVEMENT", "ASSIGN", "FINISH_MOVEMENT"]) state = transition(state, event);
  assert.strictEqual(state.demandSnapshot, snapshot);
  assert.equal(state.demandSnapshot.predictionScore, .82);
  const fresh = initialState();
  assert.equal(fresh.demoPhase, "INITIAL");
  assert.equal(fresh.prediction.probability, 0);
  assert.equal(fresh.vehicle.assignedUserId, null);
  assert.deepEqual(fresh.logs, []);
  assert.equal(fresh.demandSnapshot, null);
});
