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
  // Stems appear as standalone text nodes (the engine renders each palace stem
  // as a single-character element whose textContent.trim() === the stem glyph).
  function __palacesForStem(stem, co) {
    var found = [];
    var walker = document.createTreeWalker(co, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() !== stem) continue;
      // Skip text inside a star-item
      var insideStar = false;
      var p = node.parentElement;
      while (p && p !== co) {
        if (p.classList && p.classList.contains('star-item')) { insideStar = true; break; }
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
  }

  function __drawArrows(co, targetCell, sources) {
    __clearArrows();
    if (!sources.length) return;

    // Ensure positioning context
    var pos = window.getComputedStyle(co).position;
    if (pos === 'static') co.style.position = 'relative';

    var coRect = co.getBoundingClientRect();
    var tRect  = targetCell.getBoundingClientRect();
    var tx = tRect.left  - coRect.left + tRect.width  / 2;
    var ty = tRect.top   - coRect.top  + tRect.height / 2;

    var svg = document.createElementNS(NS, 'svg');
    svg.id = 'sihua-in';
    svg.setAttribute('xmlns', NS);
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:8500;overflow:visible;';

    // Arrow-head markers, one per enhancer type
    var defs = document.createElementNS(NS, 'defs');
    ['Lu','Quan','Ke','Ji'].forEach(function(t) {
      var m = document.createElementNS(NS, 'marker');
      m.setAttribute('id', 'sia-' + t);
      m.setAttribute('markerWidth',  '8');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('refX', '7');
      m.setAttribute('refY', '3');
      m.setAttribute('orient', 'auto');
      var poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', '0 0, 8 3, 0 6');
      poly.setAttribute('fill', COLORS[t]);
      m.appendChild(poly);
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    var n = sources.length;
    sources.forEach(function(src, i) {
      var sRect = src.cell.getBoundingClientRect();
      var sx = sRect.left - coRect.left + sRect.width  / 2;
      var sy = sRect.top  - coRect.top  + sRect.height / 2;
      var col = COLORS[src.type];

      // Perpendicular offset so multiple arrows between same pair fan out
      var dx = tx - sx, dy = ty - sy;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var spread = (i - (n - 1) / 2) * 12;
      var ox = (-dy / len) * spread;
      var oy = ( dx / len) * spread;

      // Quadratic bezier: control point pulled perpendicular to midpoint
      var mx = (sx + tx) / 2 + ox * 3;
      var my = (sy + ty) / 2 + oy * 3;

      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d',
        'M' + (sx + ox) + ' ' + (sy + oy) +
        ' Q' + mx + ' ' + my +
        ' ' + (tx + ox) + ' ' + (ty + oy));
      path.setAttribute('stroke', col);
      path.setAttribute('stroke-width', '2.2');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', 'url(#sia-' + src.type + ')');
      path.setAttribute('opacity', '0.88');
      svg.appendChild(path);

      // Stem label near the source end
      var lx = sx + ox + (dx / len) * 22;
      var ly = sy + oy + (dy / len) * 22;
      var txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', lx);
      txt.setAttribute('y', ly);
      txt.setAttribute('fill', col);
      txt.setAttribute('font-size', '12');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.textContent = src.stem;
      svg.appendChild(txt);
    });

    co.appendChild(svg);
  }

  document.addEventListener('DOMContentLoaded', function() {
    // Capture phase fires before the engine's bubbling handlers
    document.addEventListener('click', function(e) {
      // Find .star-item ancestor of clicked element
      var el = e.target;
      while (el && el !== document.body) {
        if (el.classList && el.classList.contains('star-item')) break;
        el = el.parentElement;
      }

      if (!el || !el.classList || !el.classList.contains('star-item')) {
        // Clicked outside a star — clear arrows and let event proceed normally
        __clearArrows();
        return;
      }

      // Star was clicked — stop engine's palace-activation handler
      e.stopPropagation();

      var enEl = el.querySelector('.star-en');
      var nameEn = enEl ? enEl.textContent.trim() : '';
      if (!nameEn) return;

      var revEntries = REV[nameEn];
      var co = document.getElementById('chart-output');
      var targetCell = __palaceCell(el);

      if (!revEntries || !revEntries.length || !co || !targetCell) {
        __clearArrows();
        return;
      }

      // Collect source palaces for every incoming enhancer
      var sources = [];
      revEntries.forEach(function(entry) {
        __palacesForStem(entry.s, co).forEach(function(cell) {
          if (cell !== targetCell) {
            sources.push({ cell: cell, type: entry.t, stem: entry.s });
          }
        });
      });

      __drawArrows(co, targetCell, sources);
    }, true);

    // Clear arrows whenever the chart re-renders (decade/year change)
    var co = document.getElementById('chart-output');
    if (co) {
      new MutationObserver(function() { __clearArrows(); })
        .observe(co, { childList: true });
    }
  });
})();
