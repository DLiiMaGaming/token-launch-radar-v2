// Token Launch Radar v2 — dashboard logic (no network, data from ../data.js).
// Written fresh in this session.

(function () {
  var D = window.RADAR;
  if (!D) return;
  var rows = D.rows;
  var meta = D.model;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function usd(n) {
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + Math.round(n);
  }
  function pct(n, d) {
    return (n * 100).toFixed(d == null ? 1 : d) + "%";
  }
  function chainsShort(chains) {
    if (chains.length <= 3) return esc(chains.join(", "));
    return esc(chains.slice(0, 3).join(", ")) + " +" + (chains.length - 3);
  }

  // --- integrity strip + footer -------------------------------------------
  document.getElementById("integrity").innerHTML =
    "<span>Snapshot <b>" + esc(meta.asOf) + "</b></span>" +
    "<span><b>" + meta.candidates + "</b> candidates</span>" +
    "<span>Watchlist <b class=\"ok\">" + meta.watchlistCovered + "/" + meta.watchlistTotal + " covered</b></span>" +
    "<span>Global multiple <b>" + meta.globalMultiple.toFixed(3) + "&times;</b> from " + meta.peerTotal + " tokenized peers</span>" +
    "<span>Held-out error <b>median |log| " + meta.heldOutMedianLogError.toFixed(2) + "</b></span>" +
    "<span>Snapshot sha256 <b>" + esc(meta.snapshotSha256.slice(0, 12)) + "&hellip;</b></span>";
  document.getElementById("asof").textContent = meta.asOf;

  // --- appendix: set-aside protocols ---------------------------------------
  document.getElementById("excluded").innerHTML = meta.excludedGroups.map(function (g) {
    return "<div class=\"grp\"><b>" + esc(g.reason) + " — " + g.count + "</b><br><span class=\"fine\">" +
      g.names.map(esc).join(" &middot; ") + (g.count > g.names.length ? " &middot; &hellip;" : "") + "</span></div>";
  }).join("");

  // --- filter controls ------------------------------------------------------
  var catSel = document.getElementById("cat");
  var chainSel = document.getElementById("chain");
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  cats.forEach(function (c) { catSel.add(new Option(c, c)); });
  chains.forEach(function (c) { chainSel.add(new Option(c, c)); });

  var state = { sortKey: "implied", sortDir: -1, q: "", cat: "", chain: "", wl: false, detail: null };

  function hashState() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return;
    h.split("&").forEach(function (part) {
      var kv = part.split("=");
      var k = decodeURIComponent(kv[0] || "");
      var v = decodeURIComponent(kv[1] || "");
      if (k === "detail") state.detail = v;
      if (k === "cat") state.cat = v;
      if (k === "chain") state.chain = v;
      if (k === "q") state.q = v;
      if (k === "wl") state.wl = v === "1";
      if (k === "focus" && v === "detail") document.body.classList.add("focus-detail");
    });
  }

  var SORTS = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    category: function (r) { return (r.category || "").toLowerCase(); },
    chains: function (r) { return r.chains.length; },
    tvl: function (r) { return r.tvl_usd; },
    change7d: function (r) { return r.change_7d == null ? -999 : r.change_7d; },
    multiple: function (r) { return r.multiple; },
    implied: function (r) { return r.implied_value_usd; },
    p_token: function (r) { return r.p_token; },
    expected: function (r) { return r.expected_value_usd; },
  };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + " " + r.slug + " " + (r.category || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = SORTS[state.sortKey] || SORTS.implied;
    list.sort(function (a, b) {
      var va = key(a), vb = key(b);
      var cmp = va < vb ? -1 : va > vb ? 1 : 0;
      if (cmp === 0) cmp = a.rank - b.rank;
      return cmp * state.sortDir;
    });
    return list;
  }

  function render() {
    var list = filtered();
    document.getElementById("count").textContent = list.length + " of " + rows.length + " shown";
    document.querySelectorAll("#board th").forEach(function (th) {
      th.classList.toggle("sorted", th.getAttribute("data-k") === state.sortKey);
    });
    document.getElementById("rows").innerHTML = list.map(function (r) {
      var chg = r.change_7d == null
        ? "<span class=\"fine\">n/a</span>"
        : "<span class=\"" + (r.change_7d >= 0 ? "up" : "down") + "\">" + (r.change_7d >= 0 ? "+" : "") + r.change_7d.toFixed(1) + "%</span>";
      return "<tr data-slug=\"" + esc(r.slug) + "\">" +
        "<td>" + r.rank + "</td>" +
        "<td><span class=\"nm\">" + esc(r.name) + "</span>" + (r.watchlist ? "<span class=\"wl\">WATCHLIST</span>" : "") + "<br><span class=\"fine\">" + esc(r.slug) + "</span></td>" +
        "<td>" + esc(r.category || "—") + "</td>" +
        "<td>" + chainsShort(r.chains) + "</td>" +
        "<td class=\"num\">" + usd(r.tvl_usd) + "</td>" +
        "<td class=\"num\">" + chg + "</td>" +
        "<td class=\"num\">" + r.multiple.toFixed(3) + "&times;</td>" +
        "<td class=\"num\"><b>" + usd(r.implied_value_usd) + "</b></td>" +
        "<td class=\"num\">" + pct(r.p_token, 0) + "</td>" +
        "<td class=\"num\">" + usd(r.expected_value_usd) + "</td></tr>";
    }).join("");
    renderDetail();
  }

  function renderDetail() {
    var box = document.getElementById("detail");
    var r = null;
    if (state.detail) {
      for (var i = 0; i < rows.length; i++) if (rows[i].slug === state.detail) { r = rows[i]; break; }
    }
    if (!r) { box.hidden = true; box.innerHTML = ""; return; }
    var f = [
      ["TVL", usd(r.tvl_usd), "from the snapshot"],
      ["Category multiple", r.multiple.toFixed(3) + "×", r.peer_count + (r.peer_count === 1 ? " tokenized peer in " : " tokenized peers in ") + (r.category || "no category")],
      ["Growth", r.growth.toFixed(3) + "×", r.change_7d == null ? "7d change not reported" : "7d TVL " + (r.change_7d >= 0 ? "+" : "") + r.change_7d.toFixed(1) + "%"],
      ["Maturity", r.maturity.toFixed(3) + "×", r.listed_at ? "tracked since " + r.listed_at : "listing date not reported"],
      ["Reach", r.reach.toFixed(3) + "×", r.chains.length + (r.chains.length === 1 ? " chain" : " chains")],
      ["Implied value", usd(r.implied_value_usd), "TVL × multiple × growth × maturity × reach"],
      ["P(token)", pct(r.p_token, 0), "category's own token record"],
      ["Expected value", usd(r.expected_value_usd), "implied × P(token)"],
    ];
    box.innerHTML =
      "<button class=\"close\" id=\"close-detail\">Close</button>" +
      "<h2>#" + r.rank + " — " + esc(r.name) + (r.watchlist ? " <span class=\"wl\" style=\"font-size:11px\">WATCHLIST</span>" : "") + "</h2>" +
      "<p class=\"fine\">" + esc(r.slug) + " &middot; " + esc(r.category || "no category") + " &middot; " + esc(r.chains.join(", ")) + "</p>" +
      "<div class=\"grid\">" + f.map(function (c) {
        return "<div class=\"cell\"><div class=\"k\">" + c[0] + "</div><div class=\"v\">" + c[1] + "</div><div class=\"s\">" + esc(c[2]) + "</div></div>";
      }).join("") + "</div>" +
      "<h3>How to farm it — about " + usd(r.farm_cost_usd) + " in costs, " + r.farm_minutes + " minutes of work</h3>" +
      "<ol>" + r.farm_steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
    box.hidden = false;
    document.getElementById("close-detail").addEventListener("click", function () {
      state.detail = null;
      document.body.classList.remove("focus-detail");
      render();
    });
  }

  document.getElementById("rows").addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-slug]");
    if (!tr) return;
    state.detail = tr.getAttribute("data-slug");
    render();
    document.getElementById("detail").scrollIntoView({ block: "start" });
  });
  document.querySelectorAll("#board th").forEach(function (th) {
    th.addEventListener("click", function () {
      var k = th.getAttribute("data-k");
      if (state.sortKey === k) state.sortDir = -state.sortDir;
      else { state.sortKey = k; state.sortDir = k === "name" || k === "category" ? 1 : -1; }
      render();
    });
  });
  document.getElementById("q").addEventListener("input", function (e) { state.q = e.target.value; render(); });
  catSel.addEventListener("change", function (e) { state.cat = e.target.value; render(); });
  chainSel.addEventListener("change", function (e) { state.chain = e.target.value; render(); });
  document.getElementById("wl").addEventListener("change", function (e) { state.wl = e.target.checked; render(); });

  hashState();
  document.getElementById("q").value = state.q;
  catSel.value = state.cat;
  chainSel.value = state.chain;
  document.getElementById("wl").checked = state.wl;
  render();
  if (state.detail && document.body.classList.contains("focus-detail")) {
    document.getElementById("detail").scrollIntoView();
  }
})();
