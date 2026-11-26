// 界面可订阅结算通知，处理顺序与原有同步调用一致。
let battlePresentation = {};

function setBattlePresentation(handlers = {}) {
  battlePresentation = handlers;
}

function notifyActivePetChanged(side, previous, incoming, reason) {
  battlePresentation.activePetChanged?.({ side, previous, incoming, reason });
}
