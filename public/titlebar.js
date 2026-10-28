// Цвета своей панели заголовка окна Electron (electron/titlebar.html) берутся
// из CSS-переменных страницы: классический и экспериментальный вид отличаются,
// поэтому пересылаем их при каждой смене класса на <html>. В новом виде полоса
// показывает и статус MTR (как в макете) — его берём из #statusBadge
// (data-next — короткая строка для полосы, см. refreshStatus в app.js).
// В браузере (без electronAPI) ничего не делает.
(function () {
  "use strict";
  var api = window.electronAPI;
  if (!api || typeof api.setTitlebarTheme !== "function") return;
  var root = document.documentElement;
  root.classList.add("has-titlebar"); // статус в шапке страницы не дублируем (ui-next.css)
  var last = "";
  function send() {
    var cs = getComputedStyle(root);
    var v = function (name) { return cs.getPropertyValue(name).trim(); };
    var next = root.classList.contains("ui-next");
    var badge = document.getElementById("statusBadge");
    var status = null;
    if (next && badge) {
      var st = ["ok", "warn", "error"].filter(function (c) { return badge.classList.contains(c); })[0] || "";
      status = { text: (badge.dataset.next || badge.textContent || "").trim(), state: st };
    }
    var theme = { bg: v("--bg"), fg: v("--text"), muted: v("--muted"), accent: v("--accent"), layout: next ? "next" : "classic", status: status };
    var key = JSON.stringify(theme);
    if (key === last) return;
    last = key;
    api.setTitlebarTheme(theme);
  }
  send();
  new MutationObserver(send).observe(root, { attributes: true, attributeFilter: ["class"] });
  function watchBadge() {
    var badge = document.getElementById("statusBadge");
    if (!badge) return;
    new MutationObserver(send).observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });
    send();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchBadge);
  else watchBadge();
})();
