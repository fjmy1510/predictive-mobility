(function (root) {
  "use strict";

  const data = typeof module !== "undefined" && module.exports ? require("./demo-data.js") : root.DemoData;

  function demandStatus(probability) {
    if (!Number.isInteger(probability) || probability < 0 || probability > 100) {
      throw new RangeError("Probability must be an integer from 0 to 100.");
    }
    if (probability >= 95) return "CONFIRMED";
    if (probability >= 90) return "PREPARED";
    if (probability >= 70) return "POSITIONING";
    if (probability >= 50) return "DETECTED";
    return "LOW";
  }

  function initialState() {
    return {
      demoPhase: "INITIAL",
      prediction: { userId: data.user.id, destination: data.user.destination, predictedDeparture: null, probability: 0, status: "LOW", reason: [] },
      vehicle: { ...data.vehicle },
      demandSnapshot: null,
      logs: [],
      moving: false,
      arrived: false,
    };
  }

  function can(state, event) {
    switch (event) {
      case "PREDICT": return state.demoPhase === "INITIAL";
      case "START_POSITIONING": return state.demoPhase === "PREDICTED";
      case "DETECT_MOVEMENT": return state.demoPhase === "POSITIONING" && !state.moving;
      case "ASSIGN": return state.demoPhase === "CONFIRMED" && !state.moving;
      case "FINISH_MOVEMENT": return state.moving && (state.demoPhase === "POSITIONING" || state.demoPhase === "ASSIGNED");
      default: return false;
    }
  }

  // Every event (including automatic transitions) goes through the same guard.
  // Rejected events preserve identity so callers cannot schedule duplicate effects.
  function transition(state, event) {
    if (!can(state, event)) return state;
    switch (event) {
      case "PREDICT": {
        const probability = data.scoring.reduce((sum, rule) => sum + rule.points, 0);
        const score = probability / 100;
        return {
          ...state,
          demoPhase: "PREDICTED",
          prediction: { ...state.prediction, predictedDeparture: data.predictedDeparture, probability, status: demandStatus(probability), reason: data.scoring.filter((rule) => rule.reason) },
          demandSnapshot: { reservationCount: 1, predictionCount: 1, reservationScore: data.reservation.score, predictionScore: score, total: (Math.round(data.reservation.score * 100) + probability) / 100, label: "HIGH DEMAND" },
          logs: [...state.logs, ...data.logs.slice(0, 4)],
        };
      }
      case "START_POSITIONING":
        return { ...state, demoPhase: "POSITIONING", vehicle: { ...state.vehicle, status: "POSITIONING", location: "AREA_A_NEAR_HOME" }, moving: true, logs: [...state.logs, ...data.logs.slice(4, 6)] };
      case "DETECT_MOVEMENT":
        return { ...state, demoPhase: "CONFIRMED", prediction: { ...state.prediction, probability: data.confirmedProbability, status: demandStatus(data.confirmedProbability) }, logs: [...state.logs, data.logs[6]] };
      case "ASSIGN":
        return { ...state, demoPhase: "ASSIGNED", vehicle: { ...state.vehicle, status: "ASSIGNED", location: "USER_PICKUP", assignedUserId: data.user.id }, moving: true, logs: [...state.logs, data.logs[7]] };
      case "FINISH_MOVEMENT":
        return { ...state, moving: false, arrived: state.demoPhase === "ASSIGNED" };
      default: return state;
    }
  }

  const api = Object.freeze({ demandStatus, initialState, can, transition });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DemoState = api;
})(globalThis);
