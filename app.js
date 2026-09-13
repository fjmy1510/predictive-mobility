(function () {
  "use strict";

  const { initialState, transition, can } = window.DemoState;
  const data = window.DemoData;
  const byId = (id) => document.getElementById(id);
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const marker = byId("vehicle-marker");
  const buttons = [byId("predict-button"), byId("detect-button"), byId("assign-button")];
  const events = ["PREDICT", "DETECT_MOVEMENT", "ASSIGN"];
  let state = initialState();
  let predictionTimer;
  let movementTimer;
  let movementStartedAt = 0;
  let displayedLogCount = 0;

  const sceneText = {
    INITIAL: ["予定をきっかけに、交通が動き出す。", "まずはAI予測を実行して、まちの変化を見てみましょう。"],
    PREDICTED: ["移動する可能性、82%。予測ができました。", "カレンダーと外出履歴から、09:28の出発を予測しました。"],
    POSITIONING: ["車両が先回り。まだ、専用車ではありません。", "山田さんが外出しなくても、この地域の別の需要に備えられます。"],
    CONFIRMED: ["移動を検知しました。確率は82%から98%へ。", "需要が確定しました。近くの車両を、ここで初めて割り当てます。"],
    ASSIGNED: ["すぐ近くから、山田さんをお迎えに。", "Vehicle-03を山田さんに割り当てました。到着見込み：1分（デモ値）。"],
  };

  function text(id, value) { byId(id).textContent = value; }

  function render() {
    const phase = state.demoPhase;
    const predicted = phase !== "INITIAL";
    const confirmed = phase === "CONFIRMED" || phase === "ASSIGNED";
    const scene = sceneText[phase];

    document.body.dataset.phase = phase;
    byId("town-map").dataset.location = state.vehicle.location;
    byId("town-map").classList.toggle("is-predicted", predicted);
    marker.dataset.location = state.vehicle.location;
    const vehicleLabel = state.arrived ? "到着" : state.moving ? (phase === "ASSIGNED" ? "迎車中" : "配置中") : phase === "INITIAL" || phase === "PREDICTED" ? "待機中" : "周辺待機";
    text("vehicle-map-label", vehicleLabel);
    marker.setAttribute("aria-label", `${data.vehicle.id}、${vehicleLabel}、${state.vehicle.assignedUserId ? "山田さんに割り当て済み" : "未割り当て"}`);
    text("vehicle-status", `${state.vehicle.status} · ${vehicleLabel}`);
    text("assignment-label", state.vehicle.assignedUserId ? "割り当て先：山田さん" : "割り当て先：なし");
    byId("user-marker").classList.toggle("detected", confirmed);
    text("scene-title", state.arrived ? "待ち時間の前に、交通がそばにいる。" : scene[0]);
    text("scene-description", state.arrived ? "需要予測 → 周辺配置 → 外出確定 → 割り当て。これが、先回りする交通です。" : scene[1]);
    text("phase-code", phase);
    text("probability", state.prediction.probability);
    text("predicted-departure", state.prediction.predictedDeparture || "—");
    text("prediction-status", `${state.prediction.status} · ${confirmed ? "移動需要が確定" : predicted ? "周辺配置の対象" : "未実行"}`);
    byId("prediction-status").className = `badge ${confirmed ? "confirmed" : predicted ? "active" : "neutral"}`;
    byId("probability-ring").setAttribute("aria-label", `移動確率${state.prediction.probability}%`);
    byId("ring-value").style.strokeDashoffset = String(100 - state.prediction.probability);
    text("ring-label", confirmed ? "移動確定" : predicted ? "予測完了" : "待機中");
    byId("reason-placeholder").hidden = predicted;
    byId("prediction-reasons").hidden = !predicted;
    byId("score-note").hidden = !predicted;
    if (predicted && !byId("prediction-reasons").childElementCount) {
      state.prediction.reason.forEach((rule) => {
        const li = document.createElement("li");
        li.textContent = rule.label;
        li.title = rule.reason;
        const points = document.createElement("span");
        points.textContent = `+${rule.points}`;
        li.append(points);
        byId("prediction-reasons").append(li);
      });
    }

    const snapshot = state.demandSnapshot;
    text("demand-status", snapshot ? snapshot.label : "予測前");
    byId("demand-status").className = `badge ${snapshot ? "active" : "neutral"}`;
    text("prediction-demand-name", snapshot ? "山田さん · 09:28 · 病院行き" : "未実行");
    text("prediction-score", snapshot ? snapshot.predictionScore.toFixed(2) : "—");
    text("demand-total", snapshot ? snapshot.total.toFixed(2) : "—");
    text("demand-count", snapshot ? `予約 ${snapshot.reservationCount}件・予測 ${snapshot.predictionCount}件` : "予約 1件・予測 未実行");
    text("demand-note", snapshot ? "予測配置時点の需要：予約 1.00 ＋ AI予測 0.82。現在の移動確率とは集計時点が異なります。" : "登録済みの予約も、これからの移動需要として捉えます。");
    renderLogs();
    byId("arrival-message").hidden = !state.arrived;

    buttons.forEach((button, index) => {
      button.disabled = !can(state, events[index]);
      button.classList.toggle("is-complete", index === 0 ? predicted : index === 1 ? confirmed : phase === "ASSIGNED");
    });
    const hint = state.arrived ? "デモ完了。再読み込みで、もう一度。" : state.moving ? (phase === "ASSIGNED" ? "近くの車両が、山田さんのもとへ移動中…" : "車両を自宅周辺へ配置しています…") : phase === "PREDICTED" ? "予測完了。車両の周辺配置を始めます…" : phase === "POSITIONING" ? "次は「外出を検知」で、移動需要を確定。" : phase === "CONFIRMED" ? "次は「配車確定」で、近くの車両を割り当て。" : "3つの操作で、未来の移動を体験。";
    text("control-hint", hint);
    text("demo-clock", state.logs.length ? state.logs[state.logs.length - 1].time : "09:10");
    text("live-status", `${state.arrived ? "呼んでいない。でも、もう来ている。車両が到着しました。" : scene[0]} ${hint}`);
  }

  function renderLogs() {
    if (displayedLogCount === state.logs.length) return;
    const scroller = byId("log-scroll");
    // Follow new entries only if the viewer has not scrolled back to read history.
    const follow = displayedLogCount === 0 || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 12;
    state.logs.slice(displayedLogCount).forEach((log) => {
      const li = document.createElement("li");
      const time = document.createElement("time");
      time.dateTime = log.time;
      time.textContent = log.time;
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = log.title;
      const detail = document.createElement("p");
      detail.textContent = log.detail;
      content.append(title, detail);
      li.append(time, content);
      byId("activity-log").append(li);
    });
    displayedLogCount = state.logs.length;
    byId("log-empty").hidden = displayedLogCount > 0;
    text("log-count", `${displayedLogCount} EVENTS`);
    if (follow) scroller.scrollTop = scroller.scrollHeight;
  }

  function dispatch(event) {
    const next = transition(state, event);
    if (next === state) return;
    const startMovement = !state.moving && next.moving;
    state = next;
    render();

    if (event === "PREDICT") {
      predictionTimer = window.setTimeout(() => dispatch("START_POSITIONING"), data.timing.prediction);
    }
    if (startMovement) {
      movementStartedAt = performance.now();
      // A timeout also covers hidden tabs, cancelled transitions, and missing events.
      movementTimer = window.setTimeout(finishMovement, motionPreference.matches ? 0 : data.timing.movement + data.timing.fallbackBuffer);
    }
  }

  function finishMovement() {
    window.clearTimeout(movementTimer);
    dispatch("FINISH_MOVEMENT");
  }

  marker.addEventListener("transitionend", (event) => {
    if (event.target !== marker || event.propertyName !== "left" || !state.moving) return;
    if (performance.now() - movementStartedAt >= data.timing.movement - 50) finishMovement();
  });
  motionPreference.addEventListener("change", (event) => {
    if (event.matches && state.moving) finishMovement();
  });
  buttons.forEach((button, index) => button.addEventListener("click", () => dispatch(events[index])));
  window.addEventListener("pagehide", () => {
    window.clearTimeout(predictionTimer);
    window.clearTimeout(movementTimer);
  });
  // A history-cache restore should follow the same reset contract as opening the demo.
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });

  document.documentElement.style.setProperty("--movement-duration", `${data.timing.movement}ms`);
  text("user-name", data.user.name);
  text("calendar-time", data.calendarEvent.time);
  text("calendar-destination", data.calendarEvent.destination);
  text("prediction-destination", data.user.destination);
  text("reservation-description", `${data.reservation.name} · ${data.reservation.time} · ${data.reservation.destination}`);
  byId("reservation-description").title = data.reservation.type;
  text("reservation-score", data.reservation.score.toFixed(2));
  render();
})();
