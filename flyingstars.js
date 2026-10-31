/* Flying Stars (玄空飞星) engine — Stars Distribution calculator.
   Method + sources: algorithms/16_flying_stars.md (Zi Wei Dou Shu project).
   Verified against all 216 下卦 and all 216 替卦 charts published in the
   Wikibooks "Feng Shui" book (Flying Star Feng Shui / Period 1–9 and
   Substitute Star / Substitute Stars Of Period 1–9, CC BY-SA 4.0).

   Palaces are Lo Shu numbers: 1 N · 2 SW · 3 E · 4 SE · 5 centre · 6 NW · 7 W · 8 NE · 9 S.
   A mountain is given as (palace of its trigram, position 1|2|3 inside it). */
(function (root) {
  "use strict";

  // Lo Shu flight path from the centre: 5 → 6 → 7 → 8 → 9 → 1 → 2 → 3 → 4
  var PATH = [5, 6, 7, 8, 9, 1, 2, 3, 4];
  var CARDINAL = { 1: true, 3: true, 7: true, 9: true };

  /* 挨星 yin/yang of the mountain at `pos` inside palace `pal`:
     cardinal trigrams 坎震离兑 → pos1 阳, pos2/3 阴;
     corner trigrams 艮巽坤乾 → pos1 阴, pos2/3 阳.  (+1 forward, -1 backward) */
  function polarity(pal, pos) {
    if (CARDINAL[pal]) return pos === 1 ? 1 : -1;
    return pos === 1 ? -1 : 1;
  }

  function fly(centre, dir) {
    var out = {};
    for (var i = 0; i < 9; i++) out[PATH[i]] = ((((centre - 1 + dir * i) % 9) + 9) % 9) + 1;
    return out;
  }

  /* Substitute-star table (替卦), Wikibooks "Determination Of Substitute Stars".
     key "originalStar,position" → [substitute star, direction]. Star 5 is never substituted. */
  var SUB = {
    "1,1":[2,1], "1,2":[1,-1], "1,3":[1,-1], "2,1":[2,-1], "2,2":[2,1], "2,3":[1,1],
    "3,1":[1,1], "3,2":[2,-1], "3,3":[2,-1], "4,1":[6,-1], "4,2":[6,1], "4,3":[6,1],
    "6,1":[6,-1], "6,2":[6,1], "6,3":[6,1], "7,1":[9,1], "7,2":[7,-1], "7,3":[7,-1],
    "8,1":[7,-1], "8,2":[7,1], "8,3":[9,1], "9,1":[7,1], "9,2":[9,-1], "9,3":[9,-1]
  };

  var OPP = { 1: 9, 9: 1, 3: 7, 7: 3, 2: 8, 8: 2, 4: 6, 6: 4 };

  /* period 1–9, sitting mountain (palace, pos), substitute flag.
     The facing mountain is the opposite palace at the same position. */
  function chart(period, sitPal, pos, substitute) {
    var base = fly(period, 1);
    function plate(pal) {
      var c = base[pal];
      if (c === 5) return fly(5, polarity(pal, pos));          // 5 borrows the mountain's own yin/yang
      if (substitute) { var s = SUB[c + "," + pos]; return fly(s[0], s[1]); }
      return fly(c, polarity(c, pos));                          // yin/yang of the same position in star c's home palace
    }
    var facePal = OPP[sitPal];
    return { period: period, base: base, mountain: plate(sitPal), facing: plate(facePal),
             sitPal: sitPal, facePal: facePal, substitute: !!substitute };
  }

  /* Wikibooks sector table: within 3° of a mountain's edge a substitute chart applies
     at the start AND end of position 1, the start of position 2, the end of position 3.
     offset = degrees from the mountain's starting edge (0–15). */
  function needsSubstitute(pos, offset) {
    var pre = offset < 3, post = offset >= 12;
    return (pos === 1 && (pre || post)) || (pos === 2 && pre) || (pos === 3 && post);
  }

  /* Periods: 20-year blocks from 立春 1864 (Period 1), repeating every 180 years.
     `solarYear` = the year whose 立春 has passed. */
  function periodOf(solarYear) {
    var n = Math.floor((solarYear - 1864) / 20);
    return { period: (((n % 9) + 9) % 9) + 1, start: 1864 + 20 * n, end: 1864 + 20 * n + 20 };
  }

  var api = { fly: fly, polarity: polarity, chart: chart, needsSubstitute: needsSubstitute,
              periodOf: periodOf, SUB: SUB };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FlyingStars = api;
})(this);
