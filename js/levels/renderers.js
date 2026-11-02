const TYPE_LABELS = {
  "password-list": "account",
  inbox: "email",
  chat: "message",
  "url-list": "website",
  router: "setting",
  dialogue: "call step",
  permissions: "app",
  ports: "service",
  code: "code sample",
  incident: "incident step",
  auth: "account",
  wifi: "network",
  marketplace: "message",
  privacy: "account",
  log: "log entry",
  terminal: "terminal entry",
  headers: "email header",
  backup: "backup set",
  repository: "repository file",
  "web-app": "web request",
  cloud: "cloud setting",
  sandbox: "sandbox behavior",
  timeline: "timeline event",
  alerts: "alert",
};

export function renderScenarioItems(level, locale, state, callbacks) {
  const resolvedByItem = new Map(
    state.issues
      .map((issue, index) => (issue.resolved ? [level.issues[index].item, true] : null))
      .filter(Boolean),
  );
  const items = [...level.items];
  if (state.variant && level.mode !== "ordered") {
    const offset = state.variant % items.length;
    items.push(...items.splice(0, offset));
  }
  return items.map((itemIndex) => {
    const issueIndex = level.issues.findIndex((issue) => issue.item === itemIndex);
    const resolved = resolvedByItem.has(itemIndex);
    const flagged = issueIndex >= 0 && state.issues[issueIndex].flagged;
    const selected = state.selectedIssue === issueIndex;
    const outOfOrder =
      level.mode === "ordered" &&
      issueIndex >= 0 &&
      !resolved &&
      issueIndex !== state.issues.findIndex((issue) => !issue.resolved);
    const labels = locale.levels[level.id - 1];
    const text = labels.items[itemIndex];
    const issue = issueIndex >= 0 ? labels.issues[issueIndex] : null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `scenario-card scenario-card--${level.type}${resolved ? " is-resolved" : ""}${selected ? " is-selected" : ""}${outOfOrder ? " is-out-of-order" : ""}`;
    button.disabled = resolved || (level.mode === "ordered" && issueIndex < 0);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      issue ? `${text.title}. ${text.detail}` : `${text.title}. ${text.detail}`,
    );
    button.addEventListener("click", () => callbacks.select(issueIndex));

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = text.title;
    button.append(title);
    const detail = document.createElement("span");
    detail.className = "card-detail";
    detail.textContent = text.detail;
    button.append(detail);
    if (issue) {
      const meta = document.createElement("span");
      meta.className = "card-meta";
      meta.textContent = resolved
        ? locale.ui.resolved
        : outOfOrder
          ? locale.ui.selectInOrder
          : flagged
            ? locale.ui.flagged
            : locale.ui.clickToInspect.replace(
                "{type}",
                locale.ui[TYPE_LABELS[level.type]] ?? locale.ui.item,
              );
      button.append(meta);
    }
    if (level.type === "timeline" && issueIndex >= 0) {
      const sequence = document.createElement("span");
      sequence.className = "card-sequence";
      sequence.textContent = String(issueIndex + 1).padStart(2, "0");
      sequence.setAttribute("aria-hidden", "true");
      button.prepend(sequence);
    }
    return button;
  });
}
