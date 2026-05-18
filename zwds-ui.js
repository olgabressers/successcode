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

// Si Hua reverse lookup: click a star → show which stems send which enhancer to it
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
  var LABELS = { Lu: '禄 Lu', Quan: '权 Quan', Ke: '科 Ke', Ji: '忌 Ji' };

  function __injectCSS() {
    if (document.getElementById('slp-css')) return;
    var s = document.createElement('style');
    s.id = 'slp-css';
    s.textContent = [
      '#slp{position:fixed;z-index:9999;background:#fff;border:1.5px solid #ccc;border-radius:8px;',
      'box-shadow:0 4px 18px rgba(0,0,0,.18);padding:12px 14px 14px;min-width:220px;max-width:300px;',
      'font-family:inherit;font-size:13px;line-height:1.5;}',
      '#slp-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}',
      '#slp-name{font-weight:700;font-size:14px;color:#222;}',
      '#slp-cn{font-size:12px;color:#666;margin-left:5px;}',
      '#slp-close{cursor:pointer;font-size:16px;color:#999;line-height:1;padding:0 2px;margin-left:8px;flex-shrink:0;}',
      '#slp-close:hover{color:#333;}',
      '#slp-sub{font-size:11px;color:#888;margin-bottom:8px;}',
      '#slp-rows{}',
      '.slp-row{display:flex;align-items:center;gap:6px;margin-bottom:5px;}',
      '.slp-badge{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;',
      'color:#fff;min-width:60px;text-align:center;}',
      '.slp-stem{font-size:13px;color:#333;}'
    ].join('');
    document.head.appendChild(s);
  }

  function __show(nameEn, nameCn, x, y) {
    __injectCSS();
    var p = document.getElementById('slp');
    if (!p) { p = document.createElement('div'); p.id = 'slp'; document.body.appendChild(p); }

    var rows = REV[nameEn];
    var rowsHtml = '';
    if (!rows || rows.length === 0) {
      rowsHtml = '<div style="color:#888;font-size:12px">No Si Hua enhancers reach this star</div>';
    } else {
      var byType = {};
      rows.forEach(function(r) {
        if (!byType[r.t]) byType[r.t] = [];
        byType[r.t].push(r.s);
      });
      ['Lu','Quan','Ke','Ji'].forEach(function(t) {
        if (!byType[t]) return;
        rowsHtml += '<div class="slp-row">' +
          '<span class="slp-badge" style="background:' + COLORS[t] + '">' + LABELS[t] + '</span>' +
          '<span class="slp-stem">' + byType[t].join('  ') + '</span>' +
          '</div>';
      });
    }

    p.innerHTML =
      '<div id="slp-head">' +
        '<div><span id="slp-name">' + nameEn + '</span><span id="slp-cn">' + (nameCn || '') + '</span></div>' +
        '<span id="slp-close">×</span>' +
      '</div>' +
      '<div id="slp-sub">Incoming Si Hua (by stem)</div>' +
      '<div id="slp-rows">' + rowsHtml + '</div>';

    p.style.display = 'block';

    var vw = window.innerWidth, vh = window.innerHeight;
    var pw = p.offsetWidth || 240, ph = p.offsetHeight || 160;
    var left = Math.min(x + 10, vw - pw - 10);
    var top  = Math.min(y + 10, vh - ph - 10);
    if (left < 6) left = 6;
    if (top  < 6) top  = 6;
    p.style.left = left + 'px';
    p.style.top  = top  + 'px';

    document.getElementById('slp-close').addEventListener('click', function(e) {
      e.stopPropagation();
      p.style.display = 'none';
    });
  }

  function __hide() {
    var p = document.getElementById('slp');
    if (p) p.style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', function() {
    // Capture phase: fires before engine bubbling handlers
    document.addEventListener('click', function(e) {
      var el = e.target;
      // Walk up to find .star-item
      while (el && el !== document.body) {
        if (el.classList && el.classList.contains('star-item')) break;
        el = el.parentElement;
      }
      if (!el || !el.classList || !el.classList.contains('star-item')) {
        // Click outside panel → close
        var p = document.getElementById('slp');
        if (p && p.style.display !== 'none' && !p.contains(e.target)) __hide();
        return;
      }
      // Found a star-item — show panel
      e.stopPropagation();
      var enEl = el.querySelector('.star-en');
      var cnEl = el.querySelector('.star-cn');
      var nameEn = enEl ? enEl.textContent.trim() : '';
      var nameCn = cnEl ? cnEl.textContent.trim() : '';
      if (!nameEn) return;
      __show(nameEn, nameCn, e.clientX, e.clientY);
    }, true);
  });
})();
