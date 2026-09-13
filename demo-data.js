(function (root) {
  "use strict";

  const data = {
    user: { id: "user-01", name: "山田さん", location: "HOME", destination: "○○病院" },
    calendarEvent: { time: "10:00", destination: "○○病院" },
    predictedDeparture: "09:28",
    vehicle: { id: "Vehicle-03", location: "DEPOT", status: "AVAILABLE", assignedUserId: null },
    scoring: [
      { label: "カレンダーに通院予定", reason: "Calendar event detected", points: 40 },
      { label: "出発まで30分以内", reason: "Departure within 30 minutes", points: 20 },
      { label: "同じ予定での外出履歴", reason: "Similar past trip detected", points: 20 },
      { label: "シナリオ補正", points: 2 },
    ],
    confirmedProbability: 98,
    reservation: { userId: "user-a", name: "Aさん", time: "09:30", destination: "○○病院", type: "RESERVATION", score: 1, area: "Area A" },
    timing: { prediction: 300, movement: 1600, fallbackBuffer: 150 },
    logs: [
      { id: "calendar", time: "09:10", title: "Calendar event detected", detail: "10:00 ○○病院" },
      { id: "departure", time: "09:11", title: "Predicted departure", detail: "09:28" },
      { id: "history", time: "09:12", title: "Similar trip history detected", detail: "同様の外出履歴を確認" },
      { id: "probability", time: "09:13", title: "Mobility probability", detail: "82%" },
      { id: "demand", time: "09:14", title: "High demand area detected", detail: "Area A · Demand Score 1.82" },
      { id: "positioning", time: "09:15", title: "Vehicle-03 positioning", detail: "自宅周辺へ配置・未割り当て" },
      { id: "movement", time: "09:27", title: "Movement detected", detail: "Probability 82% → 98%" },
      { id: "assigned", time: "09:28", title: "Vehicle-03 Assigned", detail: "ETA 1 min" },
    ],
  };

  function deepFreeze(value) {
    Object.values(value).forEach((item) => {
      if (item && typeof item === "object") deepFreeze(item);
    });
    return Object.freeze(value);
  }

  deepFreeze(data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.DemoData = data;
})(globalThis);
