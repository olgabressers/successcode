// zwds-ui.js — shared utilities for all ZWDS calculator pages
// Included by zwds.html and zwds-alena.html
// Edit here once; both pages update automatically.

// IANA-based UTC offset for a given birth location + date
function __computeUtcOffset(lat, lon, dateStr, timeStr) {
  if (typeof tzlookup !== 'function') return null;
  var tzName;
  try { tzName = tzlookup(lat, lon); } catch(e) { return null; }
  if (!tzName) return null;
  var birthDT = new Date((dateStr || '2000-01-01') + 'T' + (timeStr || '12:00') + ':00Z');
  try {
    var parts = new Intl.DateTimeFormat('en', {
      timeZone: tzName, timeZoneName: 'shortOffset'
    }).formatToParts(birthDT);
    for (var k = 0; k < parts.length; k++) {
      if (parts[k].type === 'timeZoneName') {
        var m = parts[k].value.match(/GMT([+-])(\d+)(?::(\d+))?/);
        if (m) return (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) + (m[3] ? parseInt(m[3]) / 60 : 0));
      }
    }
  } catch(e) {}
  return null;
}

// Auto-correct UTC offset when user selects a city from the dropdown
function __tzCorrect(i) {
  var dd    = document.getElementById('city-dropdown');
  var lonEl = document.getElementById('birth-longitude');
  if (!dd || !dd._data || !dd._data[i] || !lonEl) return;
  var lat = parseFloat(dd._data[i].lat);
  var lon = parseFloat(lonEl.value);
  if (isNaN(lat) || isNaN(lon)) return;
  var dateStr = (document.getElementById('birth-date') || {}).value || '2000-01-01';
  var timeStr = (document.getElementById('birth-time') || {}).value || '12:00';
  var offset  = __computeUtcOffset(lat, lon, dateStr, timeStr);
  if (offset === null) return;
  var offStr = offset % 1 !== 0 ? offset.toFixed(1) : String(offset);
  var utcEl = document.getElementById('utc-offset');
  if (utcEl) {
    utcEl.value = offStr;
    if (typeof updateSolarPreview === 'function') updateSolarPreview();
  }
  var cr = document.getElementById('city-result');
  if (cr) {
    cr.innerHTML = cr.innerHTML.replace(
      /UTC[+\-]?\d+(\.\d+)?(\s*\([^)]*\))?/i,
      'UTC' + (offset >= 0 ? '+' : '') + offStr
    );
  }
}

// Dynamic annual layer:
//   - Annual content hidden by default (natal + decade only on load)
//   - Click a year tag  → annual ON for that year
//   - Click same tag    → annual OFF (back to natal + decade)
//   - Click ± buttons   → switch year while keeping annual ON
//   - Click Annual label → toggle ON / OFF
(function() {
  var _activeYear = null;
  var _curYear    = String(new Date().getFullYear());
  var _timer      = null;
  var _ANN        = '.pal-ann-mov, .ebadge-ann, .pal-annual';

  function __getYr(el) {
    var m = el.textContent.match(/(20\d\d)/);
    return m ? m[1] : null;
  }

  // Inline styles beat everything, including the engine's own inline styles
  function __applyState(co) {
    var on = co.classList.contains('annual-on');
    co.querySelectorAll(_ANN).forEach(function(el) {
      if (on) { el.style.removeProperty('display'); }
      else    { el.style.setProperty('display', 'none', 'important'); }
    });
    co.querySelectorAll('.pal-year-tag').forEach(function(tag) {
      if (tag.textContent.indexOf(_curYear) !== -1) tag.classList.add('current-year');
    });
  }

  function __onYearClick(co, yr) {
    if (co.classList.contains('annual-on') && yr === _activeYear) {
      co.classList.remove('annual-on');
      _activeYear = null;
    } else {
      co.classList.add('annual-on');
      _activeYear = yr;
    }
    // Delay lets the engine finish its own re-render before we apply visibility
    setTimeout(function() { __applyState(co); }, 60);
  }

  // Direct listeners on each element — unaffected by stopPropagation from engine handlers
  function __bind(co) {
    co.querySelectorAll('.pal-year-tag').forEach(function(tag) {
      if (tag._ab) return;
      tag._ab = true;
      tag.addEventListener('click', function() {
        var yr = __getYr(tag);
        if (yr) __onYearClick(co, yr);
      });
    });
    co.querySelectorAll('.year-btn').forEach(function(btn) {
      if (btn._ab) return;
      btn._ab = true;
      btn.addEventListener('click', function() {
        co.classList.add('annual-on');
        setTimeout(function() {
          var yv = co.querySelector('.annual-year-val');
          if (yv) _activeYear = yv.textContent.replace(/\D/g, '');
          __applyState(co);
        }, 60);
      });
    });
    co.querySelectorAll('.ltag-annual').forEach(function(el) {
      if (el._ab) return;
      el._ab = true;
      el.addEventListener('click', function() {
        var nowOn = !co.classList.contains('annual-on');
        if (!nowOn) _activeYear = null;
        co.classList.toggle('annual-on');
        setTimeout(function() { __applyState(co); }, 60);
      });
    });
  }

  // Re-bind and re-apply after every engine re-render (initial load, decade change, etc.)
  var obs = new MutationObserver(function() {
    var co = document.getElementById('chart-output');
    if (!co || !co.querySelector('.layer-controls')) return;
    clearTimeout(_timer);
    _timer = setTimeout(function() { __bind(co); __applyState(co); }, 80);
  });

  document.addEventListener('DOMContentLoaded', function() {
    var co = document.getElementById('chart-output');
    if (co) obs.observe(co, { childList: true, subtree: true });
  });
})();

// Si Hua reverse lookup: click a star → draw incoming arrows from source palaces
(function() {
  var REV = {
    'Lian Zhen':  [{s:'甲',t:'Lu'},{s:'丙',t:'Ji'}],
    'Po Jun':     [{s:'甲',t:'Quan'},{s:'癸',t:'Lu'}],
    'Wu Qu':      [{s:'甲',t:'Ke'},{s:'己',t:'Lu'},{s:'庚',t:'Quan'},{s:'壬',t:'Ji'}],
    'Tai Yang':   [{s:'甲',t:'Ji'},{s:'庚',t:'Lu'},{s:'辛',t:'Quan'}],
    'Tian Ji':    [{s:'乙',t:'Lu'},{s:'丙',t:'Quan'},{s:'丁',t:'Ke'},{s:'戊',t:'Ji'}],
    'Tian Liang': [{s:'乙',t:'Quan'},{s:'己',t:'Ke'},{s:'壬',t:'Lu'}],
    'Zi Wei':     [{s:'乙',t:'Ke'},{s:'壬',t:'Quan'}],
    'Tai Yin':    [{s:'乙',t:'Ji'},{s:'丁',t:'Lu'},{s:'戊',t:'Quan'},{s:'庚',t:'Ke'},{s:'癸',t:'Ke'}],
    'Tian Tong':  [{s:'丙',t:'Lu'},{s:'丁',t:'Quan'},{s:'庚',t:'Ji'}],
    'Wen Chang':  [{s:'丙',t:'Ke'},{s:'辛',t:'Ji'}],
    'Ju Men':     [{s:'丁',t:'Ji'},{s:'辛',t:'Lu'},{s:'癸',t:'Quan'}],
    'Tan Lang':   [{s:'戊',t:'Lu'},{s:'己',t:'Quan'},{s:'癸',t:'Ji'}],
    'You Bi':     [{s:'戊',t:'Ke'}],
    'Wen Qu':     [{s:'己',t:'Ji'},{s:'辛',t:'Ke'}],
    'Zuo Fu':     [{s:'壬',t:'Ke'}]
  };

  var COLORS = { Lu: '#166020', Quan: '#1020b8', Ke: '#a08000', Ji: '#aa1010' };
  var NS = 'http://www.w3.org/2000/svg';

  // Timestamp of the last __drawArrows call — used to suppress MutationObserver
  // clearing that fires because the engine re-renders after our stopPropagation
  // call only blocks capture-phase handlers, not the engine's bubble handlers.
  var _lastDraw = 0;

  // Walk up from el to find nearest .palace-cell ancestor
  function __palaceCell(el) {
    var e = el;
    while (e && e !== document.body) {
      if (e.classList && e.classList.contains('palace-cell')) return e;
      e = e.parentElement;
    }
    return null;
  }

  // Find all .palace-cell elements whose stem text node matches the given stem.
  // The engine renders each palace stem as a single-character text inside the
  // palace header. We skip any text found inside a .star-en element (star names)
  // and match only exact single-char stem glyphs.
  function __palacesForStem(stem, co) {
    var found = [];
    var walker = document.createTreeWalker(co, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() !== stem) continue;
      // Skip text that lives inside a .star-en (English star name)
      var p = node.parentElement;
      var insideStar = false;
      while (p && p !== co) {
        if (p.classList && p.classList.contains('star-en')) { insideStar = true; break; }
        p = p.parentElement;
      }
      if (insideStar) continue;
      var cell = __palaceCell(node.parentElement);
      if (cell && found.indexOf(cell) === -1) found.push(cell);
    }
    return found;
  }

  function __clearArrows() {
    var el = document.getElementById('sihua-in');
    if (el) el.remove();
    // Also clear outgoing overlay and its decorations
    var out = document.getElementById('sihua-out');
    if (out) out.remove();
    document.querySelectorAll('.sihua-self-badge').forEach(function(b) { b.remove(); });
    document.querySelectorAll('.palace-cell').forEach(function(c) {
      c.classList.remove('flight-source','flight-target-lu','flight-target-quan','flight-target-ke','flight-target-ji');
    });
  }

  // Draw a filled arrowhead polygon at the tip of each arrow.
  // We avoid url(#marker-id) entirely because that reference is resolved
  // against document.URL (not the SVG element), which breaks on any page
  // served from a sub-path or after a history.pushState URL change.
  // Instead we compute the tip position and orientation from the bezier
  // tangent and append a plain <polygon> element directly to the SVG.
  function __arrowhead(svg, tx, ty, dx, dy, col) {
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;    // unit vector toward tip
    var px = -uy,     py =  ux;          // perpendicular
    var size = 10, half = 3.5;
    // Three vertices: tip, left-base, right-base
    var x0 = tx,                 y0 = ty;
    var x1 = tx - ux*size + px*half, y1 = ty - uy*size + py*half;
    var x2 = tx - ux*size - px*half, y2 = ty - uy*size - py*half;
    var poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points',
      x0.toFixed(2) + ',' + y0.toFixed(2) + ' ' +
      x1.toFixed(2) + ',' + y1.toFixed(2) + ' ' +
      x2.toFixed(2) + ',' + y2.toFixed(2));
    poly.setAttribute('fill', col);
    poly.setAttribute('opacity', '0.92');
    svg.appendChild(poly);
  }

  function __drawArrows(targetCell, sources) {
    __clearArrows();
    if (!sources.length) return;
    _lastDraw = Date.now();

    // Absolute-positioned SVG on body at document origin.
    // position:absolute scrolls with the page (unlike fixed), so arrows stay
    // anchored to palace cells as the user scrolls.
    // Coordinates = getBoundingClientRect() + current scroll offset = document space.
    var scrollX = window.scrollX || window.pageXOffset || 0;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var dW = Math.max(document.documentElement.scrollWidth,  window.innerWidth);
    var dH = Math.max(document.documentElement.scrollHeight, window.innerHeight);

    var svg = document.createElementNS(NS, 'svg');
    svg.id = 'sihua-in';
    svg.setAttribute('xmlns', NS);
    svg.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'width:'  + dW + 'px',
      'height:' + dH + 'px',
      'pointer-events:none',
      'z-index:8500',
      'overflow:visible'
    ].join(';');

    var tRect = targetCell.getBoundingClientRect();
    var tx = tRect.left + scrollX + tRect.width  / 2;
    var ty = tRect.top  + scrollY + tRect.height / 2;

    var n = sources.length;
    sources.forEach(function(src, i) {
      var sRect = src.cell.getBoundingClientRect();
      var sx = sRect.left + scrollX + sRect.width  / 2;
      var sy = sRect.top  + scrollY + sRect.height / 2;
      var col = COLORS[src.type];

      var dx = tx - sx, dy = ty - sy;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var spread = (i - (n - 1) / 2) * 12;
      var ox = (-dy / len) * spread;
      var oy = ( dx / len) * spread;

      // Control point for quadratic bezier (offset perpendicular to midpoint)
      var mx = (sx + tx) / 2 + ox * 3;
      var my = (sy + ty) / 2 + oy * 3;

      // Shorten the path end by 9px so the arrowhead polygon sits exactly
      // at the visual tip and the stroke doesn't poke through it.
      var shortFrac = Math.max(0, (len - 9)) / (len || 1);
      var tipX = sx + ox + (tx - sx + ox - ox) * shortFrac;  // approximate shortened tip
      // Simpler: compute the last few pixels of the straight approach to the tip
      // using the tangent at the bezier end (which is the vector from Q to end).
      var bEndX = tx + ox, bEndY = ty + oy;
      var tangX = bEndX - mx,  tangY = bEndY - my;
      var tangLen = Math.sqrt(tangX*tangX + tangY*tangY) || 1;
      var pathEndX = bEndX - (tangX/tangLen)*9;
      var pathEndY = bEndY - (tangY/tangLen)*9;

      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d',
        'M' + (sx+ox).toFixed(2) + ' ' + (sy+oy).toFixed(2) +
        ' Q' + mx.toFixed(2) + ' ' + my.toFixed(2) +
        ' ' + pathEndX.toFixed(2) + ' ' + pathEndY.toFixed(2));
      path.setAttribute('stroke', col);
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.9');
      svg.appendChild(path);

      // Inline arrowhead polygon at the true tip (avoids url(#marker) entirely)
      __arrowhead(svg, bEndX, bEndY, tangX, tangY, col);

      // Stem label near source
      var lx = sx + ox + (dx / len) * 24;
      var ly = sy + oy + (dy / len) * 24;
      var txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', String(lx));
      txt.setAttribute('y', String(ly));
      txt.setAttribute('fill', col);
      txt.setAttribute('font-size', '13');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.textContent = src.stem;
      svg.appendChild(txt);
    });

    document.body.appendChild(svg);
  }

  // Hit-test: find a .star-en whose bounding box contains the click point.
  // Completely avoids guessing the star wrapper class — purely coordinate-based.
  function __hitStarEn(clientX, clientY) {
    var stars = document.querySelectorAll('#chart-output .star-en');
    var pad = 8;
    for (var i = 0; i < stars.length; i++) {
      var r = stars[i].getBoundingClientRect();
      if (clientX >= r.left - pad && clientX <= r.right  + pad &&
          clientY >= r.top  - pad && clientY <= r.bottom + pad) {
        return stars[i];
      }
    }
    return null;
  }

  function __dbg(msg) {
    var d = document.getElementById('sihua-dbg');
    if (!d) {
      d = document.createElement('div');
      d.id = 'sihua-dbg';
      d.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:99999;background:rgba(0,0,0,.82);color:#aef;font:11px/1.5 monospace;padding:8px 12px;border-radius:5px;max-width:320px;white-space:pre-wrap;pointer-events:none;';
      document.body.appendChild(d);
    }
    d.textContent = msg;
  }

  document.addEventListener('DOMContentLoaded', function() {
    // Capture phase fires before the engine's bubbling handlers
    document.addEventListener('click', function(e) {
      var co = document.getElementById('chart-output');

      // Report basic state
      var starCount = co ? co.querySelectorAll('.star-en').length : -1;
      var palCount  = co ? co.querySelectorAll('.palace-cell').length : -1;
      __dbg('click x=' + Math.round(e.clientX) + ' y=' + Math.round(e.clientY) +
            '\n.star-en found: ' + starCount +
            '\n.palace-cell found: ' + palCount +
            '\ntarget: ' + (e.target.className || e.target.tagName));

      var starEnEl = __hitStarEn(e.clientX, e.clientY);

      if (!starEnEl) {
        __dbg('click x=' + Math.round(e.clientX) + ' y=' + Math.round(e.clientY) +
              '\n.star-en found: ' + starCount +
              '\n.palace-cell found: ' + palCount +
              '\ntarget: ' + (e.target.className || e.target.tagName) +
              '\n→ no star hit');
        __clearArrows();
        return;
      }

      // Use preventDefault + stopImmediatePropagation so the engine's own
      // click handler (which re-renders #chart-output and would trigger the
      // MutationObserver that clears our arrows) does not fire.
      e.preventDefault();
      e.stopImmediatePropagation();

      var nameEn = starEnEl.textContent.trim();
      var revEntries = REV[nameEn];
      var targetCell = __palaceCell(starEnEl);

      __dbg('STAR HIT: "' + nameEn + '"' +
            '\nREV entries: ' + (revEntries ? revEntries.length : 'none') +
            '\ntargetCell: ' + (targetCell ? targetCell.className.slice(0,30) : 'NOT FOUND'));

      if (!nameEn || !revEntries || !revEntries.length || !co || !targetCell) {
        __clearArrows();
        return;
      }

      var sources = [];
      revEntries.forEach(function(entry) {
        __palacesForStem(entry.s, co).forEach(function(cell) {
          if (cell !== targetCell) {
            sources.push({ cell: cell, type: entry.t, stem: entry.s });
          }
        });
      });

      __dbg('STAR HIT: "' + nameEn + '"' +
            '\nREV entries: ' + revEntries.length +
            '\nsource palaces: ' + sources.length +
            '\n→ drawing arrows');

      __drawArrows(targetCell, sources);
    }, true);

    var co = document.getElementById('chart-output');
    if (co) {
      new MutationObserver(function() {
        // Suppress clearing if arrows were drawn within the last 600ms —
        // this covers engine re-renders that race with our draw call even
        // after stopImmediatePropagation (e.g. deferred engine timeouts).
        if (Date.now() - _lastDraw < 600) return;
        __clearArrows();
      }).observe(co, { childList: true });
    }
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// Solar BaZi year pillar — LiChun calendar fix
//
// The obfuscated engine renders the Solar BaZi pillars using LiChun-based
// methods for month/day/hour but lunar.getYearGan()/getYearZhi() (CNY-based)
// for the year — producing an inconsistent Solar pillar when the birth date
// falls between LiChun (Feb 4) and CNY (varies).
//
// Example: Maxim 1977-02-15 — LiChun was Feb 4, CNY was Feb 18.
//   Lunar (ZWDS) year = 丙辰 (CNY) — correct, drives ZWDS natal enhancers
//   Solar (BaZi) year = 丁巳 (LiChun) — correct per BaZi convention
// The engine showed Solar year as 丙辰 (wrong).
//
// This patch finds the Solar section's year pillar after each chart render
// and replaces the stem/branch with the LiChun-based values. It does NOT
// touch the Lunar section or the ZWDS engine internals.
// ─────────────────────────────────────────────────────────────────────────────
(function() {
  var _timer = null;

  function __findPillar(section, kindRe) {
    var pillars = section.querySelectorAll('.bazi-pillar');
    for (var i = 0; i < pillars.length; i++) {
      var lbl = pillars[i].querySelector('.bazi-pillar-label');
      if (lbl && kindRe.test(lbl.textContent)) return pillars[i];
    }
    return null;
  }

  function __fixSolarBaziYear() {
    if (typeof Solar === 'undefined') return;
    var co = document.getElementById('chart-output');
    if (!co) return;
    var dual = co.querySelector('.bazi-dual');
    if (!dual) return;
    var sections = dual.querySelectorAll('.bazi-section');
    if (sections.length < 2) return;

    var dateEl = document.getElementById('birth-date');
    var timeEl = document.getElementById('birth-time');
    if (!dateEl || !dateEl.value) return;
    var ds = dateEl.value.split('-');
    if (ds.length < 3) return;
    var ts = (timeEl && timeEl.value ? timeEl.value : '12:00').split(':');

    var lunar;
    try {
      var s = Solar.fromYmdHms(+ds[0], +ds[1], +ds[2], +ts[0], +(ts[1] || 0), 0);
      lunar = s.getLunar();
    } catch(e) { return; }

    var cnyGan = lunar.getYearGan(),         cnyZhi = lunar.getYearZhi();
    var liGan  = lunar.getYearGanByLiChun(), liZhi  = lunar.getYearZhiByLiChun();
    // No discrepancy → nothing to patch (chart born after both LiChun & CNY)
    if (cnyGan === liGan && cnyZhi === liZhi) return;

    var liMonthGan = lunar.getMonthGanExact();
    var liMonthZhi = lunar.getMonthZhiExact();

    var YEAR_RE  = /год|year|年/i;
    var MONTH_RE = /месяц|month|月/i;
    var SOLAR_RE = /solar|節氣|节气|立春|солнечн|bazi|ba\s*zi/i;

    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var lbl = sec.querySelector('.bazi-section-label');
      var lblText = lbl ? lbl.textContent : '';

      var isSolar = SOLAR_RE.test(lblText);
      if (!isSolar) {
        // Heuristic fallback: identify by month pillar matching LiChun-based month
        var monthP = __findPillar(sec, MONTH_RE);
        if (monthP) {
          var mc = monthP.querySelectorAll('.bazi-char');
          if (mc.length >= 2 && mc[0].textContent === liMonthGan && mc[1].textContent === liMonthZhi) {
            isSolar = true;
          }
        }
      }
      if (!isSolar) continue;

      var yearP = __findPillar(sec, YEAR_RE);
      if (!yearP) {
        var pillars = sec.querySelectorAll('.bazi-pillar');
        yearP = pillars[pillars.length - 1];
      }
      if (!yearP) continue;

      var chars = yearP.querySelectorAll('.bazi-char');
      if (chars.length >= 2) {
        chars[0].textContent = liGan;
        chars[1].textContent = liZhi;
      } else if (chars.length === 1) {
        chars[0].textContent = liGan + liZhi;
      }
      break;
    }
  }

  var obs = new MutationObserver(function() {
    var co = document.getElementById('chart-output');
    if (!co || !co.querySelector('.bazi-dual')) return;
    clearTimeout(_timer);
    _timer = setTimeout(__fixSolarBaziYear, 90);
  });

  document.addEventListener('DOMContentLoaded', function() {
    var co = document.getElementById('chart-output');
    if (co) obs.observe(co, { childList: true, subtree: true });
  });
})();
