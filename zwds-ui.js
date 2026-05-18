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
