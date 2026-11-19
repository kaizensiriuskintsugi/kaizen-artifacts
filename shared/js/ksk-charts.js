/* KSK Dashboard charts — tiny SVG helpers for ksk-dashboard.css (v1.0, 2026-11-04).
   No dependencies. Colours come from CSS tokens (--kd-c1..c6, --kd-seq-*), so charts follow the theme.
   API:
     KD.line(el, {labels, series:[{name, data, slot?}], format?, area?, height?, ariaLabel?})
       slot = fixed palette index (0-5) so a series keeps its colour when filters drop others
     KD.bars(el, rows:[[label, value]], {max?, format?})
     KD.table(el, {labels, series, format?, labelHead?})   // data-table view for any line chart
     KD.legend(el, series)
     KD.toggle(button, target)                             // "Show table" / "Hide table"
   Rules baked in: one y-axis, zero baseline, series colour by fixed order (entity, not rank),
   direct end labels with collision nudge, crosshair + tooltip on hover/touch. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const fmt0 = new Intl.NumberFormat("en-CA");
  const colour = (i) => `var(--kd-c${(i % 6) + 1})`;
  let tip;
  function getTip() {
    if (!tip) { tip = document.createElement("div"); tip.className = "kd-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip);
      addEventListener("scroll", () => (tip.style.opacity = 0), { passive: true }); }
    return tip;
  }
  // Axis top = 4 × a nice step, so the 5 gridlines land on round numbers
  function niceMax(v) {
    if (v <= 0) return 4;
    const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    return step * 4;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function observe(el, draw) {
    draw();
    if (el._kdRO) el._kdRO.disconnect();
    let w = el.clientWidth;
    el._kdRO = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; draw(); } });
    el._kdRO.observe(el);
  }

  function line(el, o) {
    el.classList.add("kd-chart");
    const f = o.format || ((v) => fmt0.format(v));
    observe(el, () => {
      const W = Math.max(280, el.clientWidth), H = o.height || Math.round(Math.min(320, Math.max(220, W * 0.42)));
      const longest = Math.max(...o.series.map((s) => s.name.length));
      const m = { t: 10, r: Math.min(90, 14 + longest * 7), b: 26, l: 34 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      const n = o.labels.length, max = niceMax(Math.max(...o.series.flatMap((s) => s.data)));
      const x = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1)), y = (v) => m.t + ih - (v / max) * ih;
      let g = "";
      for (let k = 0; k <= 4; k++) { const v = (max / 4) * k;
        g += `<line class="${k ? "kd-gridline" : "kd-baseline"}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(f(v))}</text>`; }
      const step = Math.ceil(n / Math.max(2, Math.floor(iw / 80)));
      o.labels.forEach((l, i) => { if ((i % step === 0 && n - 1 - i >= step * 0.6) || i === n - 1) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(l)}</text>`; });
      const paths = o.series.map((s, k) => {
        const d = s.data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join("");
        const area = o.area ? `<path class="kd-area" style="fill:${colour(o.series[k].slot ?? k)}" d="${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z"/>` : "";
        return area + `<path class="kd-line" style="stroke:${colour(o.series[k].slot ?? k)}" d="${d}"/>`;
      }).join("");
      const ends = o.series.map((s, k) => ({ k, y: y(s.data[n - 1]) })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
      const labels = o.series.length <= 4 ? ends.map((e) => `<text class="kd-end" x="${W - m.r + 8}" y="${e.y + 4}">${esc(o.series[e.k].name)}</text>`).join("") : "";
      el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(o.ariaLabel || "Line chart: " + o.series.map((s) => s.name).join(", "))}">${g}${paths}${labels}
        <line class="kd-cross" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/><g class="kd-dots"></g><rect x="${m.l}" y="0" width="${iw}" height="${H}" fill="transparent"/></svg>`;
      const svg = el.firstElementChild, cross = svg.querySelector(".kd-cross"), dots = svg.querySelector(".kd-dots"), hit = svg.querySelector("rect"), t = getTip();
      const move = (e) => {
        const r = hit.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const i = Math.max(0, Math.min(n - 1, Math.round((px / iw) * (n - 1))));
        cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
        dots.innerHTML = o.series.map((s, k) => `<circle class="kd-dot" cx="${x(i)}" cy="${y(s.data[i])}" r="4.5" style="fill:${colour(o.series[k].slot ?? k)}"/>`).join("");
        t.innerHTML = `<div class="kd-tip-t">${esc(o.labels[i])}</div>` + o.series.map((s, k) => `<div class="kd-tip-row"><span><i style="background:${colour(o.series[k].slot ?? k)}"></i>${esc(s.name)}</span><b>${esc(f(s.data[i]))}</b></div>`).join("");
        const cx = r.left + x(i) - m.l, flip = cx + t.offsetWidth + 24 > innerWidth;
        t.style.left = (flip ? cx - t.offsetWidth - 14 : cx + 14) + "px"; t.style.top = r.top + 16 + "px"; t.style.opacity = 1;
      };
      const out = () => { t.style.opacity = 0; cross.setAttribute("visibility", "hidden"); dots.innerHTML = ""; };
      hit.addEventListener("mousemove", move); hit.addEventListener("mouseleave", out);
      hit.addEventListener("touchstart", move, { passive: true }); hit.addEventListener("touchmove", move, { passive: true }); hit.addEventListener("touchend", out);
    });
  }

  function bars(el, rows, o = {}) {
    const f = o.format || ((v) => fmt0.format(v)), max = o.max || Math.max(...rows.map((r) => r[1]));
    el.classList.add("kd-bars");
    el.innerHTML = rows.map(([l, v]) => `<div class="kd-bar"><span>${esc(l)}</span><div class="kd-bar-track" role="img" aria-label="${esc(l)}: ${esc(f(v))}"><div class="kd-bar-fill" style="width:${(v / max) * 100}%"></div></div><span class="kd-bar-val">${esc(f(v))}</span></div>`).join("");
  }

  function table(el, o) {
    const f = o.format || ((v) => fmt0.format(v));
    el.innerHTML = `<div class="kd-table-wrap"><table class="kd-table"><thead><tr><th>${esc(o.labelHead || "")}</th>${o.series.map((s) => `<th class="kd-num">${esc(s.name)}</th>`).join("")}</tr></thead><tbody>` +
      o.labels.map((l, i) => `<tr><td>${esc(l)}</td>${o.series.map((s) => `<td class="kd-num">${esc(f(s.data[i]))}</td>`).join("")}</tr>`).join("") + `</tbody></table></div>`;
  }

  function legend(el, series) {
    el.classList.add("kd-legend");
    el.innerHTML = series.map((s, k) => `<span><i style="background:${colour(s.slot ?? k)}"></i>${esc(s.name)}</span>`).join("");
  }

  function toggle(btn, target) {
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", () => { target.hidden = !target.hidden; btn.textContent = target.hidden ? "Show table" : "Hide table"; btn.setAttribute("aria-expanded", String(!target.hidden)); });
  }

  window.KD = { line, bars, table, legend, toggle, colour };
})();
