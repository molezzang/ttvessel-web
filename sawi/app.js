/* =========================================================
   예비사위 검증소 — app
   저장은 localStorage 에만. 서버 전송 없음.
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'sawi_state_v1';
  var KEY_SAVED = 'sawi_saved_v1';

  var SCALE = [
    { v: 0, l: '전혀<br>아니다' },
    { v: 1, l: '아닌<br>편' },
    { v: 2, l: '그런<br>편' },
    { v: 3, l: '매우<br>그렇다' },
    { v: null, l: '모르<br>겠다' }
  ];

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        s.quick = s.quick || {};
        s.deep = s.deep || {};
        s.red = s.red || {};
        return s;
      }
    } catch (e) {}
    return { quick: {}, deep: {}, red: {} };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(KEY_SAVED)) || []; } catch (e) { return []; }
  }
  function putSaved(list) {
    try { localStorage.setItem(KEY_SAVED, JSON.stringify(list)); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function $(id) { return document.getElementById(id); }

  /* ---------------- 렌더: 척도 문항 ---------------- */
  function scaleHTML(group, id, cur) {
    var h = '<div class="scale">';
    for (var i = 0; i < SCALE.length; i++) {
      var s = SCALE[i];
      var on = (cur !== undefined && cur === s.v) ? ' on' : '';
      var val = (s.v === null) ? 'x' : s.v;
      h += '<button type="button" class="' + on.trim() + '" data-g="' + group + '" data-i="' + id + '" data-v="' + val + '">' + s.l + '</button>';
    }
    return h + '</div>';
  }

  function itemHTML(group, idx, item, n) {
    var cur = state[group][idx];
    var answered = (cur !== undefined) ? ' answered' : '';
    var rev = item.rev ? ' <span style="font-size:11px;font-weight:800;color:#d4402f;vertical-align:2px">역문항</span>' : '';
    var hint = item.h ? '<div class="hint">👁 ' + esc(item.h) + '</div>' : '';
    return '<div class="q' + answered + '" id="q-' + group + '-' + idx + '">' +
      '<div class="qt"><span class="n">' + n + '</span><span>' + esc(item.t) + rev + '</span></div>' +
      hint + scaleHTML(group, idx, cur) + '</div>';
  }

  function renderQuick() {
    var h = '';
    for (var i = 0; i < QUICK.length; i++) h += itemHTML('quick', i, QUICK[i], i + 1);
    $('quickList').innerHTML = h;
  }

  function renderDeep() {
    var h = '', n = 0;
    for (var d = 0; d < DOMAINS.length; d++) {
      var dom = DOMAINS[d];
      h += '<div class="dom"><h3>' + dom.icon + ' ' + esc(dom.name) + '</h3><p class="dd">' + esc(dom.desc) + '</p>';
      var items = DEEP[dom.key];
      for (var i = 0; i < items.length; i++) {
        n++;
        h += itemHTML('deep', dom.key + '_' + i, items[i], n);
      }
      h += '</div>';
    }
    $('deepList').innerHTML = h;
  }

  function renderRed() {
    var h = '';
    for (var i = 0; i < RED_FLAGS.length; i++) {
      var f = RED_FLAGS[i];
      var on = state.red[f.id] ? ' on' : '';
      var lv = f.lv === 'critical' ? '치명' : '주의';
      h += '<label class="chk' + on + '" data-red="' + f.id + '">' +
        '<input type="checkbox" ' + (state.red[f.id] ? 'checked' : '') + ' data-red-input="' + f.id + '">' +
        '<span class="txt"><span class="lv ' + f.lv + '">' + lv + '</span>' + esc(f.t) + '</span></label>';
    }
    $('redList').innerHTML = h;
  }

  /* ---------------- 질문 은행 ---------------- */
  var bankFilter = 'all';
  var bankPick = null;

  function renderBankFilters() {
    var h = '<button data-f="all" class="' + (bankFilter === 'all' ? 'on' : '') + '">전체</button>';
    for (var i = 0; i < BANK.length; i++) {
      var c = BANK[i];
      h += '<button data-f="' + c.key + '" class="' + (bankFilter === c.key ? 'on' : '') + '">' + c.icon + ' ' + esc(c.name) + '</button>';
    }
    $('bankFilters').innerHTML = h;
  }

  function bankItems() {
    var out = [];
    for (var i = 0; i < BANK.length; i++) {
      if (bankFilter !== 'all' && BANK[i].key !== bankFilter) continue;
      for (var j = 0; j < BANK[i].items.length; j++) {
        out.push({ cat: BANK[i], it: BANK[i].items[j], id: BANK[i].key + '_' + j });
      }
    }
    return out;
  }

  function renderBank() {
    renderBankFilters();
    var list = bankItems();
    var total = 0;
    for (var i = 0; i < BANK.length; i++) total += BANK[i].items.length;
    $('bankCount').textContent = '총 ' + total + '개';

    if (bankPick) {
      list = list.filter(function (x) { return bankPick.indexOf(x.id) >= 0; });
    }
    var h = '';
    if (bankPick) {
      h += '<div class="note"><b>오늘의 질문 3개.</b> 이것만 물어보세요. 한 번에 다 물으면 취조가 됩니다. 다시 뽑으려면 버튼을 한 번 더 누르세요.</div>';
    }
    for (var k = 0; k < list.length; k++) {
      var x = list[k];
      h += '<div class="bq">' +
        '<div class="cat">' + x.cat.icon + ' ' + esc(x.cat.name) + '</div>' +
        '<div class="qq">' + esc(x.it.q) + '</div>' +
        '<div class="ans g"><span class="mark">안심</span><span>' + esc(x.it.good) + '</span></div>' +
        '<div class="ans b"><span class="mark">체크</span><span>' + esc(x.it.bad) + '</span></div>' +
        '</div>';
    }
    $('bankList').innerHTML = h;
  }

  function renderField() {
    var h = '';
    for (var i = 0; i < FIELD.length; i++) {
      var f = FIELD[i];
      h += '<div class="fc"><h4>' + f.icon + ' <span>' + (i + 1) + '. ' + esc(f.t) + '</span></h4><ul>';
      for (var j = 0; j < f.p.length; j++) h += '<li>' + esc(f.p[j]) + '</li>';
      h += '</ul></div>';
    }
    $('fieldList').innerHTML = h;
  }

  function renderDocs() {
    var h = '';
    for (var i = 0; i < DOCS.length; i++) {
      var d = DOCS[i];
      h += '<div class="doc"><h4>' + (i + 1) + '. ' + esc(d.t) + '</h4><dl>' +
        '<dt>발급처</dt><dd>' + esc(d.where) + '</dd>' +
        '<dt>무엇을 볼 것인가</dt><dd>' + esc(d.check) + '</dd></dl>' +
        (d.note ? '<div class="warnnote">⚠ ' + esc(d.note) + '</div>' : '') +
        '</div>';
    }
    $('docList').innerHTML = h;
  }

  /* ---------------- 채점 ---------------- */
  function scoreOf(item, v) {
    return item.rev ? (3 - v) : v;
  }

  function compute() {
    var got = 0, max = 0, answered = 0, unknown = 0, total = QUICK.length + 36;
    var i, v;

    for (i = 0; i < QUICK.length; i++) {
      v = state.quick[i];
      if (v === undefined) continue;
      if (v === null) { unknown++; continue; }
      got += scoreOf(QUICK[i], v); max += 3; answered++;
    }

    var doms = [];
    for (var d = 0; d < DOMAINS.length; d++) {
      var key = DOMAINS[d].key, items = DEEP[key], dg = 0, dm = 0, da = 0, du = 0;
      for (i = 0; i < items.length; i++) {
        v = state.deep[key + '_' + i];
        if (v === undefined) continue;
        if (v === null) { du++; unknown++; continue; }
        dg += scoreOf(items[i], v); dm += 3; da++;
        got += scoreOf(items[i], v); max += 3; answered++;
      }
      doms.push({
        key: key, icon: DOMAINS[d].icon, name: DOMAINS[d].name,
        pct: dm ? Math.round(dg / dm * 100) : null,
        answered: da, unknown: du, total: items.length
      });
    }

    var crit = 0, warn = 0;
    for (i = 0; i < RED_FLAGS.length; i++) {
      if (!state.red[RED_FLAGS[i].id]) continue;
      if (RED_FLAGS[i].lv === 'critical') crit++; else warn++;
    }

    var base = max ? Math.round(got / max * 100) : null;
    var pct = base;
    if (pct !== null) pct = Math.max(0, pct - warn * 4);
    if (crit > 0) pct = pct === null ? 0 : Math.min(pct, 25);

    return {
      pct: pct, base: base, doms: doms, crit: crit, warn: warn,
      answered: answered, unknown: unknown, total: total,
      coverage: Math.round((answered + unknown) / total * 100)
    };
  }

  function gradeOf(pct) {
    for (var i = 0; i < GRADES.length; i++) if (pct >= GRADES[i].min) return GRADES[i];
    return GRADES[GRADES.length - 1];
  }
  function barColor(p) {
    return p >= 75 ? '#12a05f' : p >= 55 ? '#d98218' : '#d4402f';
  }

  /* ---------------- 레이더 차트 ---------------- */
  function radarSVG(doms) {
    var cx = 170, cy = 155, R = 108, n = doms.length, i, a, x, y;
    var s = '<svg class="radar" viewBox="0 0 340 300" role="img" aria-label="영역별 점수 레이더 차트">';
    for (var g = 1; g <= 4; g++) {
      var pts = [];
      for (i = 0; i < n; i++) {
        a = -Math.PI / 2 + i * 2 * Math.PI / n;
        pts.push((cx + Math.cos(a) * R * g / 4).toFixed(1) + ',' + (cy + Math.sin(a) * R * g / 4).toFixed(1));
      }
      s += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="#e6e9ee" stroke-width="1"/>';
    }
    for (i = 0; i < n; i++) {
      a = -Math.PI / 2 + i * 2 * Math.PI / n;
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * R).toFixed(1) + '" y2="' + (cy + Math.sin(a) * R).toFixed(1) + '" stroke="#e6e9ee" stroke-width="1"/>';
    }
    var vp = [];
    for (i = 0; i < n; i++) {
      a = -Math.PI / 2 + i * 2 * Math.PI / n;
      var r = R * ((doms[i].pct === null ? 0 : doms[i].pct) / 100);
      vp.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
    }
    s += '<polygon points="' + vp.join(' ') + '" fill="rgba(31,111,235,.16)" stroke="#1f6feb" stroke-width="2"/>';
    for (i = 0; i < n; i++) {
      a = -Math.PI / 2 + i * 2 * Math.PI / n;
      x = cx + Math.cos(a) * (R + 26); y = cy + Math.sin(a) * (R + 22);
      var anchor = Math.abs(Math.cos(a)) < 0.25 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      s += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" font-size="11.5" font-weight="700" fill="#5d6570">' + doms[i].name + '</text>';
    }
    return s + '</svg>';
  }

  /* ---------------- 결과 ---------------- */
  function todoList(r) {
    var out = [];
    if (r.crit > 0) {
      out.push('<b>지금 당장:</b> 위험 신호(치명) 항목이 ' + r.crit + '개 체크됐습니다. 결혼 준비를 멈추고 딸과 <b>단둘이</b> 이야기하세요. 남자친구를 설득하려 하지 말고, 딸의 안전과 마음부터 확인하세요.');
    }
    var weak = r.doms.filter(function (d) { return d.pct !== null && d.pct < 60; })
      .sort(function (a, b) { return a.pct - b.pct; });
    for (var i = 0; i < Math.min(3, weak.length); i++) {
      out.push('<b>' + weak[i].icon + ' ' + weak[i].name + ' (' + weak[i].pct + '점):</b> 이 영역의 질문 은행을 열어 이번 주에 2~3개만 물어보세요.');
    }
    var unknownDoms = r.doms.filter(function (d) { return d.unknown >= 2 || d.answered + d.unknown < d.total; });
    if (unknownDoms.length) {
      var names = unknownDoms.map(function (d) { return d.name; }).join(', ');
      out.push('<b>아직 모르는 영역:</b> ' + names + '. 판단하기 전에 확인이 먼저입니다.');
    }
    if (r.warn > 0) {
      out.push('<b>주의 신호 ' + r.warn + '건:</b> 하나하나는 넘길 수 있지만 겹치면 패턴입니다. 딸에게 "이런 적 있었니?"라고 사례를 물어보세요.');
    }
    if (r.coverage < 60) {
      out.push('<b>응답률 ' + r.coverage + '%:</b> 아직 절반도 채우지 못했습니다. 점수를 믿기 전에 문항을 더 채우세요.');
    }
    if (!out.length) {
      out.push('큰 구멍이 보이지 않습니다. 남은 것은 <b>서류 확인</b>과 <b>상황 관찰</b>입니다. 두 탭을 확인해보세요.');
    }
    out.push('<b>마지막으로:</b> 아빠·엄마·딸이 각자 채점해 비교해보세요. 세 사람의 점수 차이가 진짜 정보입니다.');
    return out;
  }

  function renderResult() {
    var r = compute();
    var box = $('resultBox');

    if (r.pct === null) {
      box.innerHTML = '<div class="result"><h3 style="margin:0 0 8px;font-size:19px">아직 응답이 없습니다</h3>' +
        '<p style="margin:0;color:var(--gray);font-size:15px">⚡ 빠른 진단 12문항부터 시작해보세요. 3분이면 됩니다.</p>' +
        '<div class="btnrow" style="margin-bottom:0"><button class="btn" data-jump="quick">빠른 진단 시작 →</button></div></div>';
      renderSaved();
      return;
    }

    var gr = gradeOf(r.pct);
    if (r.crit > 0) gr = GRADES[GRADES.length - 1];

    var h = '';

    if (r.crit > 0) {
      h += '<div class="note alarm" style="font-size:15px"><b>🚨 점수보다 먼저 봐야 할 것이 있습니다.</b><br>' +
        '치명 위험 신호 ' + r.crit + '개가 체크되었습니다. 이런 항목은 다른 장점으로 상쇄되지 않습니다. ' +
        '결혼 여부를 논하기 전에 딸의 안전을 먼저 확인하세요. 페이지 아래 24시간 상담 창구를 참고하시고, ' +
        '딸을 다그치지 마세요 — 다그치면 딸은 그를 감싸게 됩니다.</div>';
    }

    h += '<div class="result">' +
      '<div class="gradebox">' +
      '<div class="big g-' + gr.g + '"><span class="g">' + gr.g + '</span><span class="s">' + r.pct + '점</span></div>' +
      '<div style="flex:1;min-width:220px"><h3>' + esc(gr.label) + '</h3><p>' + esc(gr.line) + '</p>' +
      '<p style="margin-top:7px;font-size:13px;color:#8b939d">응답 ' + r.answered + '개 · 모르겠다 ' + r.unknown + '개 · 응답률 ' + r.coverage + '%' +
      (r.warn ? ' · 주의 신호 ' + r.warn + '건(-' + (r.warn * 4) + '점)' : '') + '</p></div></div>';

    var hasDeep = r.doms.some(function (d) { return d.pct !== null; });
    if (hasDeep) {
      h += radarSVG(r.doms);
      h += '<div class="bars">';
      for (var i = 0; i < r.doms.length; i++) {
        var d = r.doms[i];
        var p = d.pct === null ? 0 : d.pct;
        h += '<div class="bar"><div class="lb"><span>' + d.icon + ' ' + esc(d.name) + '</span><span>' +
          (d.pct === null ? '미응답' : d.pct + '점') + (d.unknown ? ' · 모름 ' + d.unknown : '') + '</span></div>' +
          '<div class="tr"><div class="fl" style="width:' + p + '%;background:' + barColor(p) + '"></div></div></div>';
      }
      h += '</div>';
    } else {
      h += '<div class="note" style="margin:20px 0 0"><b>심층 36문항을 아직 하지 않으셨습니다.</b> 영역별 그래프는 심층 진단을 마치면 나타납니다.</div>';
    }

    var todos = todoList(r);
    h += '<div class="todo"><h4>✅ 다음에 할 일</h4><ul>';
    for (var t = 0; t < todos.length; t++) h += '<li>' + todos[t] + '</li>';
    h += '</ul></div>';

    h += '<p style="margin:18px 0 0;font-size:12.5px;color:#9aa3ac;line-height:1.6">이 점수는 심리검사 결과가 아닙니다. 응답한 사람의 관찰을 정리한 것일 뿐이며, 사람의 가치를 판정하지 않습니다.</p>';
    h += '</div>';

    box.innerHTML = h;
    renderSaved();
  }

  function summaryText() {
    var r = compute();
    if (r.pct === null) return '아직 응답이 없습니다.';
    var gr = r.crit > 0 ? GRADES[GRADES.length - 1] : gradeOf(r.pct);
    var s = '[예비사위 검증소 결과]\n종합 ' + r.pct + '점 (' + gr.g + ' · ' + gr.label + ')\n';
    s += '응답 ' + r.answered + '개 / 모르겠다 ' + r.unknown + '개 / 응답률 ' + r.coverage + '%\n';
    if (r.crit) s += '🚨 치명 위험 신호 ' + r.crit + '건\n';
    if (r.warn) s += '⚠ 주의 신호 ' + r.warn + '건\n';
    s += '\n[영역별]\n';
    for (var i = 0; i < r.doms.length; i++) {
      s += r.doms[i].name + ': ' + (r.doms[i].pct === null ? '미응답' : r.doms[i].pct + '점') + '\n';
    }
    s += '\n※ 심리검사가 아니라 대화를 위한 정리입니다.';
    return s;
  }

  /* ---------------- 저장된 결과 ---------------- */
  function renderSaved() {
    var list = loadSaved(), h = '';
    if (!list.length) {
      h = '<div class="note" style="margin:0">아직 저장된 결과가 없습니다. 이름을 적고 <b>이 결과 저장</b>을 누르면 여기에 쌓입니다.</div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        h += '<div class="saved"><div class="pill g-' + s.grade + '">' + s.grade + '</div>' +
          '<div class="m"><b>' + esc(s.name) + ' — ' + s.pct + '점</b>' +
          '<span>' + esc(s.date) + ' · 응답률 ' + s.coverage + '%' + (s.crit ? ' · 🚨 치명 ' + s.crit + '건' : '') + '</span></div>' +
          '<button class="del" data-del="' + i + '" title="삭제">×</button></div>';
      }
      var gaps = domainGaps(list);
      if (gaps) h += '<div class="note" style="margin-top:12px">' + gaps + '</div>';
    }
    $('savedList').innerHTML = h;
  }

  function domainGaps(list) {
    var withDom = list.filter(function (s) { return s.doms; });
    if (withDom.length < 2) return '';
    var out = [], i, j;
    for (i = 0; i < DOMAINS.length; i++) {
      var vals = [];
      for (j = 0; j < withDom.length; j++) {
        var v = withDom[j].doms[DOMAINS[i].key];
        if (typeof v === 'number') vals.push({ n: withDom[j].name, v: v });
      }
      if (vals.length < 2) continue;
      vals.sort(function (a, b) { return a.v - b.v; });
      var gap = vals[vals.length - 1].v - vals[0].v;
      if (gap >= 20) {
        out.push('<b>' + DOMAINS[i].name + '</b> ' + gap + '점 차 (' +
          esc(vals[0].n) + ' ' + vals[0].v + ' ↔ ' + esc(vals[vals.length - 1].n) + ' ' + vals[vals.length - 1].v + ')');
      }
    }
    if (!out.length) return '<b>채점자들의 시각이 대체로 일치합니다.</b> 같은 것을 보고 있다는 뜻이니, 결과를 조금 더 믿어도 됩니다.';
    return '<b>👀 여기서 가족의 생각이 갈립니다.</b><br>' + out.join('<br>') +
      '<br><br>점수 차이가 큰 영역은 누가 맞고 틀린 게 아니라, <b>서로 다른 정보를 갖고 있다</b>는 뜻입니다. 이 영역부터 가족끼리 이야기해보세요.';
  }

  /* ---------------- 진행률 ---------------- */
  function updateProgress() {
    var done = 0, total = QUICK.length + 36, i;
    for (i = 0; i < QUICK.length; i++) if (state.quick[i] !== undefined) done++;
    for (var d = 0; d < DOMAINS.length; d++) {
      for (i = 0; i < DEEP[DOMAINS[d].key].length; i++) {
        if (state.deep[DOMAINS[d].key + '_' + i] !== undefined) done++;
      }
    }
    $('progText').textContent = done + ' / ' + total;
    $('progFill').style.width = (done / total * 100) + '%';
  }

  /* ---------------- 탭 ---------------- */
  function showPanel(name) {
    var panels = document.querySelectorAll('.panel');
    for (var i = 0; i < panels.length; i++) panels[i].classList.toggle('on', panels[i].id === 'p-' + name);
    var btns = $('tabRow').querySelectorAll('button');
    for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('on', btns[j].getAttribute('data-p') === name);
    if (name === 'result') renderResult();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 이벤트 ---------------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('#tabRow button');
    if (tab) { showPanel(tab.getAttribute('data-p')); return; }

    var jump = e.target.closest && e.target.closest('[data-jump]');
    if (jump) { showPanel(jump.getAttribute('data-jump')); return; }

    var sc = e.target.closest && e.target.closest('.scale button');
    if (sc) {
      var g = sc.getAttribute('data-g'), id = sc.getAttribute('data-i'), raw = sc.getAttribute('data-v');
      var val = raw === 'x' ? null : parseInt(raw, 10);
      var key = (g === 'quick') ? parseInt(id, 10) : id;
      if (state[g][key] === val) delete state[g][key]; else state[g][key] = val;
      save();
      var wrap = sc.closest('.q');
      var bs = wrap.querySelectorAll('.scale button');
      for (var i = 0; i < bs.length; i++) {
        var v2 = bs[i].getAttribute('data-v');
        var mine = (v2 === 'x') ? null : parseInt(v2, 10);
        bs[i].classList.toggle('on', state[g][key] !== undefined && state[g][key] === mine);
      }
      wrap.classList.toggle('answered', state[g][key] !== undefined);
      updateProgress();
      return;
    }

    var fbtn = e.target.closest && e.target.closest('#bankFilters button');
    if (fbtn) { bankFilter = fbtn.getAttribute('data-f'); bankPick = null; renderBank(); return; }

    var del = e.target.closest && e.target.closest('[data-del]');
    if (del) {
      var list = loadSaved();
      list.splice(parseInt(del.getAttribute('data-del'), 10), 1);
      putSaved(list); renderSaved(); return;
    }
  });

  document.addEventListener('change', function (e) {
    var cb = e.target.getAttribute && e.target.getAttribute('data-red-input');
    if (!cb) return;
    if (e.target.checked) state.red[cb] = 1; else delete state.red[cb];
    save();
    e.target.closest('.chk').classList.toggle('on', !!e.target.checked);
  });

  $('quickGo').addEventListener('click', function () { showPanel('result'); });

  $('pickBtn').addEventListener('click', function () {
    var pool = bankItems();
    if (bankPick) bankPick = null;
    var ids = pool.map(function (x) { return x.id; });
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    bankPick = ids.slice(0, 3);
    renderBank();
  });

  $('printBank').addEventListener('click', function () { window.print(); });
  $('printBtn').addEventListener('click', function () { window.print(); });

  $('copyBtn').addEventListener('click', function () {
    var txt = summaryText(), btn = this;
    function done() { var o = btn.textContent; btn.textContent = '✅ 복사됨'; setTimeout(function () { btn.textContent = o; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { alert(txt); }
      document.body.removeChild(ta);
    }
  });

  $('saveBtn').addEventListener('click', function () {
    var r = compute();
    if (r.pct === null) { alert('먼저 문항에 응답해주세요.'); return; }
    var name = ($('saveName').value || '').trim() || '채점자';
    var gr = r.crit > 0 ? GRADES[GRADES.length - 1] : gradeOf(r.pct);
    var doms = {};
    for (var i = 0; i < r.doms.length; i++) if (r.doms[i].pct !== null) doms[r.doms[i].key] = r.doms[i].pct;
    var list = loadSaved();
    list.push({
      name: name, pct: r.pct, grade: gr.g, coverage: r.coverage, crit: r.crit, warn: r.warn,
      doms: doms, date: new Date().toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
    });
    putSaved(list);
    $('saveName').value = '';
    renderSaved();
  });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('모든 응답과 저장된 결과를 지웁니다. 계속할까요?')) return;
    try { localStorage.removeItem(KEY); localStorage.removeItem(KEY_SAVED); } catch (e) {}
    state = { quick: {}, deep: {}, red: {} };
    renderQuick(); renderDeep(); renderRed(); renderResult(); updateProgress();
    showPanel('quick');
  });

  /* ---------------- init ---------------- */
  renderQuick();
  renderDeep();
  renderRed();
  renderBank();
  renderField();
  renderDocs();
  renderSaved();
  updateProgress();
})();
