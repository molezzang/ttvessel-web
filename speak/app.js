/* SPEAK LAB — 카메라 스피치 코칭
 * 모든 처리는 브라우저 안에서만 이루어진다. 업로드 경로는 존재하지 않는다.
 */

/* ────────────────────────────── 지표 정의 ────────────────────────────── */
// source: 이 지표를 계산하는 데 필요한 신호. 신호가 없으면 지표를 빼고 가중치를 재분배한다.
const METRICS = {
  pace:          { label: '말 속도',        unit: '음절/분', scale: [0, 500],  src: 'stt',   fmt: v => Math.round(v) },
  fillerRate:    { label: '군말(음·어·그)', unit: '회/분',   scale: [0, 15],   src: 'stt',   fmt: v => v.toFixed(1) },
  volumeLevel:   { label: '성량 크기',      unit: '',        scale: [0, 0.6],  src: 'audio', fmt: v => Math.round(v * 100) },
  volumeStability:{ label: '성량 안정성',   unit: '변동',    scale: [0, 1.2],  src: 'audio', fmt: v => v.toFixed(2) },
  pitchRange:    { label: '억양 폭',        unit: '반음',    scale: [0, 10],   src: 'audio', fmt: v => v.toFixed(1) },
  pauseQuality:  { label: '쉼 비율',        unit: '%',       scale: [0, 0.6],  src: 'audio', fmt: v => Math.round(v * 100) },
  eyeContact:    { label: '정면 응시',      unit: '%',       scale: [0, 100],  src: 'face',  fmt: v => Math.round(v) },
  sway:          { label: '몸 흔들림',      unit: '%',       scale: [0, 35],   src: 'face',  fmt: v => v.toFixed(1) },
  smile:         { label: '미소 지수',      unit: '',        scale: [0, 0.8],  src: 'face',  fmt: v => v.toFixed(2) },
  expressionVar: { label: '표정 변화폭',    unit: '',        scale: [0, 0.6],  src: 'face',  fmt: v => v.toFixed(2) },
  shoulderTilt:  { label: '어깨 수평',      unit: '°',       scale: [0, 15],   src: 'pose',  fmt: v => v.toFixed(1) },
  gesture:       { label: '제스처 활동량',  unit: '',        scale: [0, 1.3],  src: 'pose',  fmt: v => v.toFixed(2) },
};

// band: 목표 구간, hard: 이 밖으로 나가면 최저점. w: 가중치.
const CATEGORIES = {
  announcer: {
    icon: '🎙️', name: '아나운서',
    desc: '정확한 전달. 흔들림 없는 시선과 자세, 일정한 속도와 성량이 핵심입니다.',
    focus: ['정면 응시를 길게 유지', '어깨·머리 고정, 몸 흔들림 최소', '속도와 성량을 일정하게'],
    rubric: {
      eyeContact:     { band: [80, 100],  hard: [40, 100],  w: .18 },
      pace:           { band: [320, 390], hard: [220, 470], w: .16 },
      fillerRate:     { band: [0, 1],     hard: [0, 8],     w: .12 },
      volumeStability:{ band: [0, .35],   hard: [0, .85],   w: .12 },
      pauseQuality:   { band: [.08, .22], hard: [0, .45],   w: .12 },
      pitchRange:     { band: [1.5, 3.2], hard: [.4, 6],    w: .10 },
      sway:           { band: [0, 6],     hard: [0, 25],    w: .10 },
      shoulderTilt:   { band: [0, 3],     hard: [0, 12],    w: .10 },
    },
    prompts: [
      { t: '뉴스 리드 읽기', s: '오늘 오후 서울 도심에서 열린 행사에 시민 오천여 명이 모였습니다. 주최 측은 안전사고 없이 행사를 마쳤다고 밝혔습니다. 자세한 내용, 현장에 나가 있는 취재기자 연결해 알아보겠습니다.' },
      { t: '발음 훈련 문장', s: '간장공장 공장장은 강 공장장이고 된장공장 공장장은 공 공장장이다.\n내가 그린 기린 그림은 목이 긴 기린 그림이고, 네가 그린 기린 그림은 목이 안 긴 기린 그림이다.\n저기 계신 저 분이 박 법학박사이시고 여기 계신 이 분이 백 법학박사이시다.' },
      { t: '날씨 전달', s: '내일 아침 기온은 오늘보다 삼 도가량 낮겠습니다. 중부지방은 새벽부터 비가 시작돼 오후에 그치겠고, 남부지방은 대체로 맑겠습니다. 바람이 강하게 불겠으니 외출하실 때 옷차림 유의하시기 바랍니다.' },
      { t: '자유 연습', s: '' },
    ],
  },
  actor: {
    icon: '🎭', name: '배우',
    desc: '감정의 진폭. 억양과 표정, 몸의 움직임이 충분히 살아 있어야 합니다.',
    focus: ['억양 폭을 넓게 — 단조로움이 최대 적', '표정 변화와 제스처를 크게', '쉼으로 감정을 만들기'],
    rubric: {
      pitchRange:     { band: [3, 7],     hard: [1, 10],    w: .20 },
      expressionVar:  { band: [.06, .25], hard: [.01, .5],  w: .18 },
      gesture:        { band: [.15, .7],  hard: [.02, 1.2], w: .14 },
      volumeStability:{ band: [.25, .7],  hard: [.05, 1.2], w: .12 },
      pauseQuality:   { band: [.12, .35], hard: [.02, .55], w: .12 },
      pace:           { band: [200, 340], hard: [120, 450], w: .10 },
      eyeContact:     { band: [30, 90],   hard: [5, 100],   w: .08 },
      fillerRate:     { band: [0, 2],     hard: [0, 10],    w: .06 },
    },
    prompts: [
      { t: '감정 전환 독백', s: '(담담하게) 나는 괜찮아. 정말이야, 아무렇지도 않아.\n(멈춤) …아니.\n(터뜨리며) 아무렇지 않은 척하는 게 얼마나 힘든 줄 알아? 매일 아침 눈을 뜨면 제일 먼저 드는 생각이 뭔 줄 알아?\n(작게) …오늘도 견뎌야 하는구나.' },
      { t: '대비 연습 — 기쁨과 분노', s: '드디어 됐어! 내가 해냈다고! 삼 년이야, 삼 년!\n…그런데 왜 아무도 안 웃어?\n너희들, 처음부터 내가 못 할 거라고 생각했지. 그렇지?' },
      { t: '내레이션 톤', s: '그해 겨울은 유난히 길었다. 골목마다 눈이 쌓였고, 사람들은 서로의 이름을 부르는 대신 고개만 숙였다. 나는 그 겨울을 오래 기억하게 된다.' },
      { t: '자유 연습', s: '' },
    ],
  },
  presenter: {
    icon: '📊', name: '발표자',
    desc: '설득력. 청중을 고르게 보고, 군말 없이, 강조와 쉼이 분명해야 합니다.',
    focus: ['군말 줄이기 — 신뢰도에 직결', '핵심 문장 앞뒤에 쉼 두기', '손은 배꼽 위, 자연스러운 제스처'],
    rubric: {
      eyeContact:     { band: [60, 95],   hard: [25, 100],  w: .16 },
      fillerRate:     { band: [0, 2],     hard: [0, 10],    w: .16 },
      pace:           { band: [260, 330], hard: [170, 430], w: .14 },
      gesture:        { band: [.12, .55], hard: [.01, 1.1], w: .12 },
      pitchRange:     { band: [2, 4.5],   hard: [.6, 7.5],  w: .12 },
      volumeLevel:    { band: [.06, .25], hard: [.015, .5], w: .10 },
      pauseQuality:   { band: [.10, .28], hard: [0, .5],    w: .10 },
      sway:           { band: [0, 10],    hard: [0, 30],    w: .10 },
    },
    prompts: [
      { t: '30초 엘리베이터 피치', s: '저희가 푸는 문제는 이겁니다. (문제 한 문장)\n지금까지의 방법은 이래서 부족했습니다. (기존 한계)\n저희는 이렇게 해결합니다. (해결책 한 문장)\n그래서 지금 이 수치가 나왔습니다. (근거 숫자)\n필요한 건 이겁니다. (요청)' },
      { t: '데이터 설명', s: '이 그래프에서 보실 부분은 딱 한 곳입니다. 3분기입니다.\n여기서 전환율이 두 배로 뛰었습니다. 이유는 세 가지입니다. 첫째, 둘째, 셋째.\n그래서 4분기에는 첫 번째 요인에 집중하려 합니다.' },
      { t: '질의응답 대응', s: '좋은 질문 감사합니다. 정리하면 “비용이 정당한가”라는 말씀이시죠.\n두 가지로 답하겠습니다. 먼저 단기 비용, 다음으로 회수 시점입니다.' },
      { t: '자유 연습', s: '' },
    ],
  },
  teacher: {
    icon: '📚', name: '선생님 · 강사',
    desc: '이해시키기. 조금 느린 속도, 살아 있는 톤, 이해할 시간을 주는 쉼이 중요합니다.',
    focus: ['속도를 의도적으로 낮추기', '중요한 말 뒤에 2초 쉼', '밝은 표정과 시선 고루 나누기'],
    rubric: {
      pace:           { band: [210, 290], hard: [140, 390], w: .16 },
      pitchRange:     { band: [2.5, 5],   hard: [.8, 8],    w: .16 },
      pauseQuality:   { band: [.15, .35], hard: [.03, .55], w: .14 },
      smile:          { band: [.05, .35], hard: [0, .7],    w: .12 },
      eyeContact:     { band: [55, 95],   hard: [20, 100],  w: .12 },
      volumeLevel:    { band: [.05, .25], hard: [.015, .5], w: .10 },
      gesture:        { band: [.10, .6],  hard: [.01, 1.1], w: .10 },
      fillerRate:     { band: [0, 3],     hard: [0, 12],    w: .10 },
    },
    prompts: [
      { t: '개념 설명 — 분수의 나눗셈', s: '분수를 분수로 나눌 때 왜 뒤집어서 곱할까요?\n피자 반 판을, 4분의 1판씩 나눠 담으면 몇 접시가 나올까요? 두 접시죠.\n이게 바로 2분의 1 나누기 4분의 1이 2가 되는 이유입니다.' },
      { t: '수업 도입부', s: '자, 오늘 배울 건 딱 하나입니다. 이것만 가져가시면 됩니다.\n지난 시간에 뭐 했는지 기억나는 사람? …네, 맞아요.\n오늘은 거기서 한 걸음만 더 나갑니다.' },
      { t: '어려운 개념 쉽게', s: '전압, 전류, 저항이 헷갈리죠. 물로 생각해 봅시다.\n전압은 물탱크의 높이, 전류는 흐르는 물의 양, 저항은 파이프의 좁은 정도입니다.\n파이프가 좁아지면? 물이 덜 흐르겠죠. 그게 저항이 커진 겁니다.' },
      { t: '자유 연습', s: '' },
    ],
  },
  interview: {
    icon: '💼', name: '면접',
    desc: '신뢰감. 시선 고정, 흔들림 없는 자세, 군말 없는 문장이 평가를 좌우합니다.',
    focus: ['면접관(카메라)을 계속 보기', '다리·상체 흔들림 없애기', '“어…” 대신 잠깐 침묵하기'],
    rubric: {
      eyeContact:     { band: [70, 98],   hard: [30, 100],  w: .20 },
      fillerRate:     { band: [0, 1.5],   hard: [0, 9],     w: .18 },
      sway:           { band: [0, 6],     hard: [0, 22],    w: .14 },
      pace:           { band: [250, 320], hard: [160, 420], w: .12 },
      smile:          { band: [.03, .25], hard: [0, .6],    w: .10 },
      shoulderTilt:   { band: [0, 3.5],   hard: [0, 13],    w: .10 },
      pauseQuality:   { band: [.08, .25], hard: [0, .45],   w: .08 },
      volumeStability:{ band: [0, .40],   hard: [0, .95],   w: .08 },
    },
    prompts: [
      { t: '1분 자기소개', s: '저를 한 문장으로 소개하면 (   )입니다.\n그렇게 말씀드리는 근거는 두 가지입니다. 첫째 (   ), 둘째 (   ).\n이 강점을 이 회사에서 (   )에 쓰고 싶습니다.' },
      { t: '지원 동기', s: '제가 이 회사를 선택한 이유는 (   )입니다.\n다른 회사가 아니라 여기여야 하는 이유는 (   )입니다.\n입사 후 1년 안에 (   )를 하고 싶습니다.' },
      { t: '갈등 경험 (STAR)', s: '상황: 언제, 어디서, 누구와.\n과제: 제가 맡은 문제는.\n행동: 제가 실제로 한 일은.\n결과: 그래서 숫자로 이렇게 바뀌었습니다.' },
      { t: '압박 질문 대응', s: '그 부분은 제 약점이 맞습니다. 인정합니다.\n다만 이렇게 보완해 왔습니다. (구체적 행동)\n그 결과 최근에는 (   )까지 개선됐습니다.' },
      { t: '자유 연습', s: '' },
    ],
  },
};

/* 지표별 코칭 문장. [낮을 때, 높을 때] */
const TIPS = {
  pace: {
    low: { announcer: '뉴스 속도치고 느립니다. 문장 끝을 늘어뜨리지 말고 마침표에서 딱 끊어 보세요.',
           actor: '느린 템포 자체는 무기지만, 지금은 전 구간이 느립니다. 빠르게 몰아치는 구간을 한 군데 만들어 대비를 주세요.',
           presenter: '청중이 지루해지는 속도입니다. 배경 설명을 줄이고 결론 문장부터 던져 보세요.',
           teacher: '설명 속도는 적당히 느린 게 좋지만 이 정도면 늘어집니다. 예시를 하나로 줄여 보세요.',
           interview: '답변이 늘어지면 준비가 덜 된 인상을 줍니다. 두괄식으로 결론부터 말하세요.' },
    high:{ announcer: '전달이 뭉갭니다. 조사(은/는/이/가)를 또박또박 짚고 문장 끝을 0.5초 붙잡으세요.',
           actor: '대사가 빨라 감정이 실릴 자리가 없습니다. 감정이 바뀌는 지점에서 한 박자 멈추세요.',
           presenter: '긴장하면 빨라집니다. 슬라이드 넘길 때마다 숨 한 번 쉬고 시작하세요.',
           teacher: '학생이 따라오기 어려운 속도입니다. 핵심 문장은 한 번 더, 반 박자 느리게.',
           interview: '급하게 들립니다. 질문을 되짚어 한 문장으로 정리하고 시작하면 속도가 잡힙니다.' } },
  fillerRate: {
    high:{ _: '“음·어·그·저기” 같은 군말이 잦습니다. 말이 막히면 소리를 내지 말고 그냥 1초 쉬세요. 침묵은 군말보다 훨씬 프로처럼 들립니다.',
           interview: '군말은 면접에서 가장 빨리 감점되는 습관입니다. 다음 문장이 떠오를 때까지 입을 다물고 기다리는 연습을 하세요.',
           presenter: '군말이 많으면 준비가 덜 된 것처럼 들립니다. 연결어를 “그래서/즉/정리하면” 같은 실제 접속어로 바꿔 보세요.' },
    low: { _: '군말이 거의 없습니다. 이 상태를 유지하세요.' } },
  volumeLevel: {
    low: { _: '목소리가 작습니다. 성대를 조이지 말고 배로 밀어 내세요. 마이크와의 거리도 확인해 보세요.',
           teacher: '뒷자리까지 닿지 않는 크기입니다. 교실 맨 뒷줄에 말한다고 생각하고 한 단계 올려 보세요.' },
    high:{ _: '지나치게 큽니다. 소리를 키우는 대신 또박또박 끊어서 강조해 보세요.' } },
  volumeStability: {
    low: { actor: '성량이 너무 일정합니다. 배우에게는 크기 변화 자체가 연기입니다. 속삭임과 폭발을 한 번씩 넣으세요.' },
    high:{ _: '문장마다 소리 크기가 들쭉날쭉합니다. 대개 문장 끝에서 힘이 빠지는 경우입니다. 끝음절까지 밀어 주세요.',
           announcer: '아나운서는 일정한 성량이 기본기입니다. 문장 끝이 흐려지지 않는지 녹음으로 확인해 보세요.' } },
  pitchRange: {
    low: { _: '억양이 단조롭습니다. 한 문장에서 가장 중요한 단어 하나만 골라 음을 확실히 올려 보세요.',
           actor: '감정선이 평평합니다. 대사를 세 덩어리로 나누고 각 덩어리의 높이를 다르게 설계하세요.',
           teacher: '톤이 평평하면 학생 집중이 빨리 떨어집니다. 질문 문장은 끝을 올리는 것만으로도 확 살아납니다.' },
    high:{ announcer: '억양 폭이 큽니다. 뉴스 전달에서는 과장되게 들릴 수 있으니 진폭을 줄이고 속도로 강조하세요.',
           interview: '톤 변화가 큽니다. 면접에서는 차분한 편이 신뢰를 줍니다.',
           _: '억양이 과합니다. 강조는 문장당 한 번이면 충분합니다.' } },
  pauseQuality: {
    low: { _: '쉼 없이 이어 말합니다. 듣는 사람이 정보를 소화할 틈이 없습니다. 마침표마다 0.5초씩만 넣어 보세요.',
           teacher: '설명 뒤에 생각할 시간을 주세요. 핵심 문장 뒤 2초 침묵이 이해도를 크게 올립니다.' },
    high:{ _: '빈 시간이 많습니다. 다음 문장이 준비되지 않은 상태로 시작한 신호입니다. 첫 문장만이라도 통으로 외워 두세요.' } },
  eyeContact: {
    low: { _: '카메라(=상대의 눈)를 보는 시간이 짧습니다. 대본을 볼 때는 소리를 내지 말고, 눈을 든 뒤에 말하는 습관을 들이세요.',
           interview: '시선이 자주 벗어나면 자신 없어 보입니다. 답변의 첫 문장과 마지막 문장만이라도 카메라를 고정해서 말해 보세요.',
           announcer: '아나운서는 정면 응시가 기본값입니다. 프롬프터를 읽더라도 시선축이 흔들리지 않게 고개를 고정하세요.' },
    high:{ actor: '카메라만 응시하고 있습니다. 상대 배우가 있는 장면이라면 시선을 흘리는 순간도 필요합니다.',
           presenter: '한 곳만 보고 있습니다. 실제 발표에서는 좌·중·우로 시선을 나눠 주세요.' } },
  sway: {
    high:{ _: '상체가 계속 흔들립니다. 발을 어깨너비로 벌리고 무게중심을 양발에 고르게 두세요. 앉아 있다면 등받이에서 주먹 하나 띄우고 골반을 세우세요.',
           interview: '흔들림은 긴장의 신호로 읽힙니다. 손을 무릎 위에 가볍게 두면 상체가 훨씬 안정됩니다.' } },
  shoulderTilt: {
    high:{ _: '어깨가 한쪽으로 기울어 있습니다. 카메라 각도가 아니라 실제 자세일 가능성이 큽니다. 양 어깨를 뒤로 한 번 돌려 내리고 다시 시작해 보세요.' } },
  gesture: {
    low: { actor: '몸이 거의 멈춰 있습니다. 감정이 몸으로 나오지 않으면 관객에게 전달되지 않습니다.',
           presenter: '손이 거의 움직이지 않습니다. 숫자를 말할 때 손가락으로 세는 것만 넣어도 훨씬 살아납니다.',
           _: '제스처가 거의 없습니다. 손을 배꼽 위로 올려 두는 것만으로 시작할 수 있습니다.' },
    high:{ _: '손 움직임이 과합니다. 강조할 때만 쓰고, 나머지 구간에서는 손을 잠깐 멈추세요.',
           interview: '제스처가 많으면 산만해 보입니다. 면접에서는 절제된 편이 안전합니다.' } },
  smile: {
    low: { teacher: '표정이 굳어 있습니다. 도입부 30초만이라도 입꼬리를 올리면 교실 분위기가 달라집니다.',
           interview: '무표정에 가깝습니다. 인사와 마무리에서만이라도 옅게 웃어 주세요.',
           _: '표정이 굳어 있습니다.' },
    high:{ interview: '계속 웃고 있습니다. 진지한 질문에는 표정을 정돈하는 것이 좋습니다.',
           _: '미소가 계속 유지됩니다. 내용에 따라 표정을 바꿔 보세요.' } },
  expressionVar: {
    low: { actor: '표정 변화가 거의 없습니다. 눈썹과 입만 움직여도 카메라는 크게 읽습니다. 대사 덩어리마다 표정을 하나씩 배정해 보세요.',
           _: '표정이 처음부터 끝까지 같습니다.' },
    high:{ _: '표정 변화가 큽니다. 카메라는 실제보다 크게 담기니 반 정도로 줄여도 충분합니다.' } },
};

const FILLERS = ['음','어','그','저기','뭐','이제','약간','좀','인제','그니까','그러니까','아니','뭐지','그래서 인제'];

/* ────────────────────────────── 음성 분석 ────────────────────────────── */
const SPEAK_RMS = 0.018;   // 이 이상이면 말하는 중으로 본다

class AudioAnalyzer {
  constructor(stream) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.src = this.ctx.createMediaStreamSource(stream);
    this.an = this.ctx.createAnalyser();
    this.an.fftSize = 2048;
    this.an.smoothingTimeConstant = 0;
    this.src.connect(this.an);
    this.buf = new Float32Array(this.an.fftSize);
    this.samples = [];       // {t, rms, f0}
    this.live = 0;
    this._n = 0;
    this._t0 = 0;
    this._timer = null;
  }
  start(t0) {
    this._t0 = t0; this.samples.length = 0; this._n = 0;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._timer = setInterval(() => this._tick(), 40);
  }
  stop() { clearInterval(this._timer); this._timer = null; }
  close() { this.stop(); try { this.ctx.close(); } catch (e) {} }

  _tick() {
    this.an.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(s / this.buf.length);
    this.live = rms;
    let f0 = -1;
    if (this._n % 3 === 0 && rms > SPEAK_RMS) f0 = this._pitch(rms);
    this._n++;
    if (this._t0) this.samples.push({ t: (performance.now() - this._t0) / 1000, rms, f0 });
  }

  // 제한 지연(70~400Hz) 정규화 자기상관
  _pitch(rms) {
    const b = this.buf, n = b.length, sr = this.ctx.sampleRate;
    const minLag = Math.floor(sr / 400), maxLag = Math.min(Math.floor(sr / 70), n >> 1);
    if (maxLag <= minLag) return -1;
    const len = n - maxLag;
    let best = -1, bestC = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let dot = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < len; i++) { const a = b[i], c = b[i + lag]; dot += a * c; e1 += a * a; e2 += c * c; }
      const corr = dot / (Math.sqrt(e1 * e2) + 1e-9);
      if (corr > bestC) { bestC = corr; best = lag; }
    }
    if (best < 0 || bestC < 0.62) return -1;
    return sr / best;
  }

  /* 요약: 성량·억양·쉼 */
  summary(duration) {
    const S = this.samples;
    if (!S.length) return null;
    const speak = S.filter(s => s.rms > SPEAK_RMS);
    const speakRatio = speak.length / S.length;
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const vol = speak.map(s => s.rms);
    const volumeLevel = vol.length ? mean(vol) : 0;
    const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
    const volumeStability = volumeLevel > 0 ? sd(vol) / volumeLevel : 0;

    const f0 = S.filter(s => s.f0 > 0).map(s => s.f0);
    let pitchRange = null, f0med = null;
    if (f0.length > 12) {
      const sorted = [...f0].sort((a, b) => a - b);
      f0med = sorted[Math.floor(sorted.length / 2)];
      const semi = f0.map(f => 12 * Math.log2(f / f0med));
      pitchRange = sd(semi);
    }

    // 무음 구간 → 쉼
    const pauses = [], segs = [];
    let silentFrom = null, voiceFrom = null;
    for (const s of S) {
      if (s.rms > SPEAK_RMS) {
        if (silentFrom !== null) { const d = s.t - silentFrom; if (d >= 0.30) pauses.push({ t: silentFrom, d }); silentFrom = null; }
        if (voiceFrom === null) voiceFrom = s.t;
      } else {
        if (silentFrom === null) silentFrom = s.t;
        if (voiceFrom !== null) { if (s.t - voiceFrom > 0.2) segs.push({ t: voiceFrom, d: s.t - voiceFrom }); voiceFrom = null; }
      }
    }
    if (voiceFrom !== null) segs.push({ t: voiceFrom, d: S[S.length - 1].t - voiceFrom });
    // 앞뒤 끝의 침묵은 쉼으로 세지 않는다
    const inner = pauses.filter(p => p.t > 0.6 && p.t + p.d < duration - 0.6);
    const pauseTime = inner.reduce((a, p) => a + p.d, 0);

    // 말한 시간이 너무 짧으면 성량·억양·쉼은 의미가 없다. 100점을 주는 대신 지표에서 뺀다.
    const speakingTime = speakRatio * duration;
    const enough = speakingTime >= 2;
    return {
      enough, speakRatio, speakingTime,
      volumeLevel: enough ? volumeLevel : null,
      volumeStability: enough ? volumeStability : null,
      pitchRange: enough ? pitchRange : null,
      f0med,
      pauseQuality: enough && duration > 0 ? pauseTime / duration : null,
      pauses: inner, segs,
      longPauses: inner.filter(p => p.d >= 1.8),
    };
  }
}

/* ────────────────────────────── 음성 인식(받아쓰기) ────────────────────────────── */
class Transcriber {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    this.text = '';
    this.interim = '';
    this.fillerHits = [];   // {t, word}
    this.onupdate = null;
    if (!this.supported) return;
    this.rec = new SR();
    this.rec.lang = 'ko-KR';
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.maxAlternatives = 1;
  }
  start(t0) {
    if (!this.supported) return;
    this.t0 = t0; this.text = ''; this.interim = ''; this.fillerHits = []; this.running = true;
    this.rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { this.text += r[0].transcript + ' '; this._scan(r[0].transcript); }
        else interim += r[0].transcript;
      }
      this.interim = interim;
      this.onupdate && this.onupdate(this.text, interim);
    };
    // 침묵으로 자동 종료되면 다시 띄운다
    this.rec.onend = () => { if (this.running) { try { this.rec.start(); } catch (e) {} } };
    this.rec.onerror = () => {};
    try { this.rec.start(); } catch (e) {}
  }
  stop() { this.running = false; if (this.supported) { try { this.rec.stop(); } catch (e) {} } }
  _scan(chunk) {
    const t = (performance.now() - this.t0) / 1000;
    for (const w of chunk.split(/\s+/)) {
      const clean = w.replace(/[.,!?…"'()]/g, '');
      if (FILLERS.includes(clean)) this.fillerHits.push({ t, word: clean });
    }
  }
  // 한글 음절 수 (숫자·영문은 대략 1글자=1음절로 센다)
  syllables() {
    const m = this.text.match(/[가-힣]/g);
    const others = this.text.match(/[0-9A-Za-z]/g);
    return (m ? m.length : 0) + (others ? Math.round(others.length * 0.5) : 0);
  }
}

/* ────────────────────────────── 영상 분석 ────────────────────────────── */
const MP_VER = '0.10.14';
/* 모델·런타임 위치. ?mp=/경로 · ?mpmodels=/경로 로 사내 미러나 오프라인 사본을 지정할 수 있다. */
const MP_Q = new URLSearchParams(location.search);
const MP_LIBS = [
  MP_Q.get('mp'),
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}`,
  `https://unpkg.com/@mediapipe/tasks-vision@${MP_VER}`,
].filter(Boolean);
const MODEL_DIR = MP_Q.get('mpmodels');
const MODEL_FACE = MODEL_DIR ? MODEL_DIR + '/face_landmarker.task'
  : 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODEL_POSE = MODEL_DIR ? MODEL_DIR + '/pose_landmarker_lite.task'
  : 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const BLEND_KEYS = ['mouthSmileLeft', 'mouthSmileRight', 'jawOpen', 'browInnerUp', 'browDownLeft', 'browDownRight', 'eyeBlinkLeft', 'eyeBlinkRight', 'mouthPucker'];

class VisionAnalyzer {
  constructor() {
    this.ready = false; this.face = null; this.pose = null;
    this.frames = [];        // {t, yaw, pitch, noseX, faceW, smile, blends[], tilt, wristMove, handsUp}
    this.baseline = null;
    this.last = null;        // 최신 프레임(HUD·오버레이용)
  }
  async load(withPose) {
    let lastErr = null;
    for (const base of MP_LIBS) {
      try {
        const mod = await import(/* @vite-ignore */ `${base}/vision_bundle.mjs`);
        const fileset = await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
        this.face = await mod.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_FACE, delegate: 'GPU' },
          runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
        });
        if (withPose) {
          this.pose = await mod.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_POSE, delegate: 'GPU' },
            runningMode: 'VIDEO', numPoses: 1,
          });
        }
        this.ready = true;
        return;
      } catch (e) { lastErr = e; this.face = null; this.pose = null; }
    }
    throw lastErr || new Error('vision runtime unavailable');
  }
  /* 한 프레임 처리 → 원시 측정값 반환 */
  detect(video, tsMs, tSec) {
    if (!this.ready) return null;
    let out = { t: tSec, ok: false };
    let fr = null;
    try { fr = this.face.detectForVideo(video, tsMs); } catch (e) { return null; }
    const lm = fr && fr.faceLandmarks && fr.faceLandmarks[0];
    if (lm) {
      const d = (a, b) => Math.hypot((a.x - b.x), (a.y - b.y));
      const nose = lm[1], eL = lm[33], eR = lm[263], top = lm[10], chin = lm[152];
      const faceW = d(eL, eR) || 1e-6;
      const faceH = d(top, chin) || 1e-6;
      out.ok = true;
      out.yaw = (d(nose, eL) - d(nose, eR)) / faceW;
      out.pitch = (nose.y - (eL.y + eR.y) / 2) / faceH;
      out.noseX = nose.x; out.noseY = nose.y; out.faceW = faceW;
      out.eyeL = eL; out.eyeR = eR; out.nose = nose;
      // 캘리브레이션을 건너뛴 경우를 위한 완만한 기준선(카메라 높이 보정)
      this._emaPitch = this._emaPitch === undefined ? out.pitch : this._emaPitch * 0.99 + out.pitch * 0.01;
      this._emaNoseX = this._emaNoseX === undefined ? out.noseX : this._emaNoseX * 0.99 + out.noseX * 0.01;
      const bs = fr.faceBlendshapes && fr.faceBlendshapes[0];
      if (bs) {
        const map = {};
        for (const c of bs.categories) map[c.categoryName] = c.score;
        out.smile = ((map.mouthSmileLeft || 0) + (map.mouthSmileRight || 0)) / 2;
        out.blink = Math.max(map.eyeBlinkLeft || 0, map.eyeBlinkRight || 0);
        out.blends = BLEND_KEYS.map(k => map[k] || 0);
      }
    }
    if (this.pose) {
      let pr = null;
      try { pr = this.pose.detectForVideo(video, tsMs); } catch (e) {}
      const pl = pr && pr.landmarks && pr.landmarks[0];
      if (pl && pl[11] && pl[12]) {
        const a = pl[11], b = pl[12];
        out.shoulder = [a, b];
        // 어깨선과 수평선이 이루는 각. 어느 쪽 어깨가 먼저 오든 같은 값이 나오도록 [-90,90]으로 접는다.
        let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
        out.tilt = ang;
        const shW = Math.hypot(a.x - b.x, a.y - b.y) || 1e-6;
        const w1 = pl[15], w2 = pl[16], h1 = pl[23], h2 = pl[24];
        out.wrists = [w1, w2];
        if (w1 && w2) {
          if (this._pw) {
            out.wristMove = (Math.hypot(w1.x - this._pw[0].x, w1.y - this._pw[0].y) +
                             Math.hypot(w2.x - this._pw[1].x, w2.y - this._pw[1].y)) / shW;
          }
          this._pw = [{ x: w1.x, y: w1.y }, { x: w2.x, y: w2.y }];
          const hipY = h1 && h2 ? (h1.y + h2.y) / 2 : 1;
          const vis = l => (l.visibility === undefined ? 1 : l.visibility);
          out.handsUp = ((w1.y < hipY && vis(w1) > .5) ? .5 : 0) + ((w2.y < hipY && vis(w2) > .5) ? .5 : 0);
        }
      }
    }
    this.last = out;
    return out;
  }
  push(f) { if (f) this.frames.push(f); }
  reset() { this.frames.length = 0; this._pw = null; }

  calibrate(list) {
    const ok = list.filter(f => f && f.ok);
    if (ok.length < 5) return null;
    const med = (arr) => { const a = arr.filter(v => v !== undefined && v !== null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
    this.baseline = {
      yaw: med(ok.map(f => f.yaw)) ?? 0,
      pitch: med(ok.map(f => f.pitch)) ?? 0,
      noseX: med(ok.map(f => f.noseX)) ?? .5,
      faceW: med(ok.map(f => f.faceW)) ?? .1,
      tilt: med(ok.map(f => f.tilt).filter(v => v !== undefined)) ?? 0,
    };
    return this.baseline;
  }
  /* 현재 프레임이 정면인가.
     yaw는 절대값(좌우 대칭 = 카메라 정면)이지만, pitch는 카메라 높이에 따라 달라지므로
     캘리브레이션 값 또는 촬영 구간의 기준선과 비교한다. */
  isFrontal(f, base) {
    if (!f || !f.ok) return false;
    const b = base || this.baseline || { yaw: 0, pitch: this._emaPitch !== undefined ? this._emaPitch : f.pitch };
    return Math.abs(f.yaw - (b.yaw ?? 0)) < 0.16 && Math.abs(f.pitch - b.pitch) < 0.085;
  }
  summary(duration) {
    const F = this.frames.filter(f => f.ok);
    if (F.length < 8) return null;
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
    const med = arr => { const a = arr.filter(v => v !== undefined && v !== null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
    const b = this.baseline || {
      yaw: 0,
      pitch: med(F.map(f => f.pitch)) ?? F[0].pitch,
      noseX: med(F.map(f => f.noseX)) ?? F[0].noseX,
      faceW: med(F.map(f => f.faceW)) ?? F[0].faceW,
      tilt: med(F.map(f => f.tilt)) ?? 0,
    };

    const frontal = F.filter(f => this.isFrontal(f, b));
    const eyeContact = frontal.length / F.length * 100;

    const faceW = mean(F.map(f => f.faceW)) || b.faceW || .1;
    const sway = sd(F.map(f => f.noseX)) / faceW * 100;

    const sm = F.map(f => f.smile).filter(v => v !== undefined);
    const smile = sm.length ? mean(sm) : null;

    let expressionVar = null;
    const withB = F.filter(f => f.blends);
    if (withB.length > 8) {
      const per = BLEND_KEYS.map((_, i) => sd(withB.map(f => f.blends[i])));
      expressionVar = mean(per.slice(0, 6));   // 눈 깜빡임은 표정 변화에서 제외
    }
    let blinkRate = null;
    if (withB.length > 8) {
      let n = 0, was = false;
      for (const f of withB) { const on = f.blink > .5; if (on && !was) n++; was = on; }
      blinkRate = duration > 0 ? n / (duration / 60) : null;
    }

    const tilts = F.map(f => f.tilt).filter(v => v !== undefined);
    const shoulderTilt = tilts.length > 8 ? mean(tilts.map(Math.abs)) : null;

    const wm = F.map(f => f.wristMove).filter(v => v !== undefined);
    const fps = F.length / Math.max(duration, .001);
    const gesture = wm.length > 8 ? mean(wm) * fps : null;      // 초당 손목 이동량(어깨너비 기준)
    const hu = F.map(f => f.handsUp).filter(v => v !== undefined);
    const handsUp = hu.length ? mean(hu) * 2 : null;

    /* 시선 이탈 구간 */
    const offs = [];
    let from = null;
    for (const f of F) {
      if (!this.isFrontal(f, b)) { if (from === null) from = f.t; }
      else { if (from !== null) { if (f.t - from >= 1.5) offs.push({ t: from, d: f.t - from }); from = null; } }
    }
    if (from !== null) { const last = F[F.length - 1].t; if (last - from >= 1.5) offs.push({ t: from, d: last - from }); }

    /* 흔들림이 심한 1초 구간 */
    const swayBursts = [];
    for (let i = 0; i < F.length; i++) {
      const w = [];
      for (let j = i; j < F.length && F[j].t - F[i].t < 1; j++) w.push(F[j].noseX);
      if (w.length < 5) break;
      const range = (Math.max(...w) - Math.min(...w)) / faceW * 100;
      if (range > 16) {
        if (!swayBursts.length || F[i].t - swayBursts[swayBursts.length - 1].t > 2.5) swayBursts.push({ t: F[i].t, range });
      }
    }
    return { eyeContact, sway, smile, expressionVar, blinkRate, shoulderTilt, gesture, handsUp, offs, swayBursts, frames: F.length };
  }
}

/* ────────────────────────────── 채점 ────────────────────────────── */
/* 목표 구간 안이면 100점.
   목표를 벗어나면 하드 한계까지 가파르게 떨어지고(한계선 = 20점), 그 밖은 8점까지 완만히 내려간다.
   1.4승을 쓰는 이유: 목표 바로 바깥과 한계선 근처를 같은 점수로 보면 변별이 되지 않기 때문. */
function bandScore(v, band, hard) {
  const [lo, hi] = band, [hlo, hhi] = hard;
  if (v >= lo && v <= hi) return 100;
  const curve = r => 20 + 80 * Math.pow(Math.max(0, Math.min(1, r)), 1.4);
  if (v < lo) {
    const span = lo - hlo;
    if (span <= 0) return 100;
    if (v >= hlo) return curve((v - hlo) / span);
    return Math.max(8, 20 * (1 - (hlo - v) / span));
  }
  const span = hhi - hi;
  if (span <= 0) return 100;
  if (v <= hhi) return curve((hhi - v) / span);
  return Math.max(8, 20 * (1 - (v - hhi) / span));
}

function collectValues(audio, vision, stt, duration) {
  const v = {};
  if (audio) {
    v.volumeLevel = audio.volumeLevel;
    v.volumeStability = audio.volumeStability;
    v.pitchRange = audio.pitchRange;
    v.pauseQuality = audio.pauseQuality;
  }
  if (vision) {
    v.eyeContact = vision.eyeContact;
    v.sway = vision.sway;
    v.smile = vision.smile;
    v.expressionVar = vision.expressionVar;
    v.shoulderTilt = vision.shoulderTilt;
    v.gesture = vision.gesture;
  }
  if (stt && stt.syll > 0 && stt.speakingTime > 2) {
    v.pace = stt.syll / (stt.speakingTime / 60);
    v.fillerRate = stt.fillers / Math.max(duration / 60, .05);
  }
  for (const k of Object.keys(v)) if (v[k] === null || v[k] === undefined || Number.isNaN(v[k])) delete v[k];
  return v;
}

function evaluate(catKey, values) {
  const cat = CATEGORIES[catKey];
  const rows = [];
  let wsum = 0;
  for (const [k, r] of Object.entries(cat.rubric)) {
    if (!(k in values)) continue;
    const score = bandScore(values[k], r.band, r.hard);
    rows.push({ key: k, value: values[k], score, band: r.band, hard: r.hard, w: r.w });
    wsum += r.w;
  }
  if (!rows.length) return { total: null, rows: [] };
  let total = 0;
  for (const r of rows) { r.wNorm = r.w / wsum; total += r.score * r.wNorm; }
  rows.sort((a, b) => b.wNorm - a.wNorm);
  return { total: Math.round(total), rows, coverage: wsum };
}

function tipFor(metric, dir, catKey) {
  const t = TIPS[metric] && TIPS[metric][dir];
  if (!t) return null;
  return t[catKey] || t._ || null;
}

function buildTips(catKey, ev) {
  const out = [];
  const weak = ev.rows.filter(r => r.score < 82).sort((a, b) => (a.score * (1 - a.wNorm)) - (b.score * (1 - b.wNorm)));
  for (const r of weak.slice(0, 4)) {
    const dir = r.value < r.band[0] ? 'low' : 'high';
    const txt = tipFor(r.key, dir, catKey);
    const M = METRICS[r.key];
    out.push({
      good: false,
      title: `${M.label} — ${dir === 'low' ? '목표보다 낮음' : '목표보다 높음'} (${M.fmt(r.value)}${M.unit})`,
      body: txt || `목표 범위는 ${M.fmt(r.band[0])}~${M.fmt(r.band[1])}${M.unit}입니다.`,
    });
  }
  const strong = ev.rows.filter(r => r.score >= 92).sort((a, b) => b.wNorm - a.wNorm);
  for (const r of strong.slice(0, 2)) {
    const M = METRICS[r.key];
    out.push({ good: true, title: `잘 되고 있는 것 — ${M.label} (${M.fmt(r.value)}${M.unit})`, body: `${CATEGORIES[catKey].name} 기준 목표 범위 안입니다. 다음 연습에서도 이 감각을 유지하세요.` });
  }
  if (!ev.rows.length) return [{ good: false, title: '측정된 지표가 없습니다',
    body: '녹화가 너무 짧거나, 마이크·카메라 신호가 잡히지 않았습니다. 마이크 권한을 확인하고 5초 이상 소리 내어 말하면서 다시 녹화해 주세요.' }];
  if (!out.length) out.push({ good: true, title: '전 지표가 목표 범위 안입니다', body: '난이도를 올려 보세요. 대본 없이, 혹은 더 긴 분량으로 연습하면 새로운 약점이 드러납니다.' });
  return out;
}

const TIERS = [
  [90, '실전에 그대로 써도 되는 수준', '핵심 지표가 목표 범위 안에 들어와 있습니다. 이제는 내용과 표현의 완성도로 넘어갈 단계입니다.'],
  [78, '기본기는 잡혔습니다', '큰 문제는 없지만 아래 지표 한두 개만 다듬으면 인상이 확 달라집니다.'],
  [64, '연습이 필요한 단계', '고칠 지점이 분명히 보입니다. 아래 코멘트에서 위쪽 한 가지만 골라 집중해 보세요.'],
  [48, '습관부터 교정할 시기', '여러 지표가 목표에서 벗어나 있습니다. 한 번에 다 고치려 하지 말고 가장 위 항목 하나만 3일 연습해 보세요.'],
  [0,  '기초 훈련 권장', '지금은 점수보다 반복이 먼저입니다. 같은 대본으로 매일 한 번씩 녹화해 변화를 보세요.'],
];
function verdict(total) { for (const [th, t, d] of TIERS) if (total >= th) return { title: t, desc: d }; }

/* ────────────────────────────── UI ────────────────────────────── */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const scColor = s => s >= 85 ? 'var(--ok)' : s >= 65 ? 'var(--accent-2)' : s >= 45 ? 'var(--warn)' : 'var(--bad)';

/* 폰인가. 화면 폭과 기기 종류를 같이 본다 (데스크톱 창을 줄인 경우도 폰 취급) */
const IS_PHONE = matchMedia('(max-width: 880px)').matches || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_STANDALONE = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

const state = {
  cat: null, promptIdx: null, script: '',
  stream: null, audio: null, stt: null, vision: null,
  rec: null, chunks: [], blob: null, blobUrl: null,
  recording: false, t0: 0, duration: 0,
  visionMode: 'loading',   // loading | ready | off
  last: null,
};

function setStep(n) {
  state.analyzePaused = n !== 3;
  if (n !== 3) { document.body.classList.remove('live', 'sheet-open'); releaseWakeLock(); }
  else if (state.stream) document.body.classList.add('live');
  $$('section.step').forEach(s => s.classList.remove('active'));
  $(`#s${n}`).classList.add('active');
  $$('.steps span').forEach(el => {
    const s = +el.dataset.s;
    el.classList.toggle('on', s === n);
    el.classList.toggle('done', s < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* STEP 1 */
function renderCats() {
  $('#catList').innerHTML = Object.entries(CATEGORIES).map(([k, c]) => `
    <button class="cat" data-k="${k}">
      <div class="ico">${c.icon}</div>
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      <div class="focus">중점: ${c.focus[0]}</div>
    </button>`).join('');
  $$('.cat').forEach(b => b.onclick = () => {
    $$('.cat').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    state.cat = b.dataset.k;
    $('#toStep2').disabled = false;
  });
}

/* STEP 2 */
function renderPrompts() {
  const c = CATEGORIES[state.cat];
  $('#promptList').innerHTML = c.prompts.map((p, i) => `
    <button class="prompt" data-i="${i}">
      <b>${p.t}</b><span>${p.s ? p.s.split('\n')[0].slice(0, 64) + (p.s.length > 64 ? '…' : '') : '대본 없이 자유롭게 말합니다.'}</span>
    </button>`).join('');
  $$('.prompt').forEach(b => b.onclick = () => {
    $$('.prompt').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
    state.promptIdx = +b.dataset.i;
    $('#scriptBox').value = c.prompts[state.promptIdx].s;
  });
  $$('.prompt')[0].click();
}

/* STEP 3 */
function renderFocus() {
  const c = CATEGORIES[state.cat];
  $('#studioTitle').textContent = `${c.icon} ${c.name} 연습 스튜디오`;
  $('#focusList').innerHTML = c.focus.map(f => `• ${f}`).join('<br>');
}

async function startCamera() {
  $('#btnCam').disabled = true;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      // 폰은 세로로 들고 쓰므로 세로 비율로 받는다. 해상도를 낮춰야 발열·끊김이 덜하다.
      video: IS_PHONE
        ? { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: 'user' }
        : { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' },
      // 자동 게인이 켜져 있으면 성량 분석이 뭉개진다
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    $('#engineNote').innerHTML = `<b>카메라를 열지 못했습니다.</b> ${e.name === 'NotAllowedError' ? '브라우저 주소창의 카메라 아이콘에서 권한을 허용해 주세요.' : e.message}`;
    $('#btnCam').disabled = false;
    return;
  }
  const v = $('#preview');
  v.srcObject = state.stream;
  await v.play().catch(() => {});
  $('#placeholder').classList.add('hidden');
  $('#btnCam').textContent = '카메라 켜짐';
  $('#btnCal').disabled = false;
  $('#btnRec').disabled = false;
  $('#mCal').disabled = false;
  document.body.classList.add('live');

  state.audio = new AudioAnalyzer(state.stream);
  state.audio.start(0);   // t0=0 → 기록은 하지 않고 HUD 미터만 돌린다
  if (!state.loopsStarted) { state.loopsStarted = true; loopVision(); meterLoop(); }
}

async function initVision() {
  const withPose = $('#optPose').checked;
  state.vision = new VisionAnalyzer();
  $('#engineNote').textContent = '분석 엔진(얼굴·자세 모델) 내려받는 중… 처음 한 번만 시간이 걸립니다.';
  try {
    await state.vision.load(withPose);
    state.visionMode = 'ready';
    $('#engineNote').innerHTML = `분석 엔진 준비 완료 — 시선·자세${withPose ? '·어깨·제스처' : ''}·표정을 측정합니다. <b>얼굴·자세 분석과 녹화는 모두 이 기기 안에서만 이루어집니다.</b>`;
  } catch (e) {
    state.visionMode = 'off';
    state.vision = null;
    $('#engineNote').innerHTML = '<b>영상 분석 엔진을 불러오지 못했습니다.</b> (네트워크 차단 또는 미지원 브라우저) 목소리·말속도 분석만으로 진행합니다. 녹화와 다시보기는 정상 동작합니다.';
  }
}

let visionRAF = null;
function loopVision() {
  const v = $('#preview'), cv = $('#overlay'), ctx = cv.getContext('2d');
  let lastMs = 0;
  const step = () => {
    visionRAF = requestAnimationFrame(step);
    if (!v.videoWidth) return;
    if (cv.width !== v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
    if (state.analyzePaused) return;
    const now = performance.now();
    if (now - lastMs < (IS_PHONE ? 100 : 62)) return;   // 폰 10fps / 데스크톱 16fps
    lastMs = now;
    let f = null;
    if (state.vision && state.vision.ready) {
      const tSec = state.recording ? (now - state.t0) / 1000 : 0;
      f = state.vision.detect(v, Math.round(now), tSec);
      if (state.recording) state.vision.push(f);
      if (state.calibrating) state.calBuf.push(f);
    }
    state.last = f;
    drawOverlay(ctx, cv, f);
    updateHud(f);
  };
  step();
}

function drawOverlay(ctx, cv, f) {
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!f || !f.ok || !$('#optLand').checked) return;
  const W = cv.width, H = cv.height;
  const frontal = state.vision.isFrontal(f);
  // 시선 표시
  ctx.strokeStyle = frontal ? '#3ddc97' : '#ff5c72';
  ctx.lineWidth = Math.max(2, W / 400);
  ctx.beginPath();
  ctx.arc(f.nose.x * W, f.nose.y * H, f.faceW * W * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f.eyeL.x * W, f.eyeL.y * H); ctx.lineTo(f.eyeR.x * W, f.eyeR.y * H); ctx.stroke();
  // 어깨선
  if (f.shoulder) {
    const [a, b] = f.shoulder;
    const dev = Math.abs(f.tilt);
    ctx.strokeStyle = dev < 4 ? '#3ddc97' : dev < 8 ? '#ffc44d' : '#ff5c72';
    ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke();
    for (const p of [a, b]) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, W / 160, 0, 7); ctx.fill(); }
  }
  if (f.wrists) {
    ctx.fillStyle = 'rgba(90,169,255,.85)';
    for (const w of f.wrists) if (w && (w.visibility === undefined || w.visibility > .5)) { ctx.beginPath(); ctx.arc(w.x * W, w.y * H, W / 150, 0, 7); ctx.fill(); }
  }
  // 기준 중심선
  if (state.vision.baseline) {
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(state.vision.baseline.noseX * W, 0); ctx.lineTo(state.vision.baseline.noseX * W, H); ctx.stroke();
  }
}

/* 같은 상태를 데스크톱 패널과 모바일 상단 칩 양쪽에 쓴다 */
function pill(sel, txt, cls) {
  for (const el of $$(sel)) {
    el.textContent = txt;
    el.className = 'pill ' + cls;
    el.hidden = txt === '–';        // 측정 전에는 빈 칩을 띄우지 않는다
  }
}

function updateHud(f) {
  if (state.audio) {
    const w = Math.min(100, state.audio.live / 0.35 * 100) + '%';
    $('#mVol').style.width = w;
    $('#mVolM').style.width = w;
  }
  if (!f || !f.ok) {
    pill('#lEye,#mEye', state.vision && state.vision.ready ? '얼굴 없음' : '–', 'mute');
    return;
  }
  const front = state.vision.isFrontal(f);
  pill('#lEye,#mEye', front ? '정면' : '시선 이탈', front ? 'ok' : 'bad');
  if (f.tilt !== undefined) {
    const dev = Math.abs(f.tilt);
    pill('#lPos,#mPos', '어깨 ' + dev.toFixed(1) + '°', dev < 4 ? 'ok' : dev < 8 ? 'warn' : 'bad');
  }
  if (state.vision.baseline) {
    const dx = Math.abs(f.noseX - state.vision.baseline.noseX) / (f.faceW || .1) * 100;
    pill('#lSway,#mSway', '흔들림 ' + dx.toFixed(0) + '%', dx < 8 ? 'ok' : dx < 18 ? 'warn' : 'bad');
  }
}

/* 녹화 중 화면이 꺼지지 않게 (지원하지 않는 브라우저에서는 조용히 넘어간다) */
async function acquireWakeLock() {
  try { if ('wakeLock' in navigator) state.wake = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function releaseWakeLock() {
  try { if (state.wake) state.wake.release(); } catch (e) {}
  state.wake = null;
}

function meterLoop() {
  setInterval(() => {
    if (state.recording) {
      const t = (performance.now() - state.t0) / 1000;
      $('#recTime').textContent = fmtTime(t);
      if (t > 300) stopRecording();
    }
    if (state.stt) {
      $('#lFill').textContent = state.stt.fillerHits.length;
      $('#lChars').textContent = state.stt.syllables();
    }
  }, 250);
}

async function calibrate() {
  if (!state.vision || !state.vision.ready) { $('#engineNote').textContent = '영상 분석 엔진이 없어 기준자세를 잡을 수 없습니다.'; return; }
  state.calBuf = []; state.calibrating = true;
  const btn = $('#btnCal'), mbtn = $('#mCal');
  btn.disabled = mbtn.disabled = true;
  for (let i = 3; i > 0; i--) {
    btn.textContent = mbtn.textContent = `정면 보기 ${i}`;
    await new Promise(r => setTimeout(r, 1000));
  }
  state.calibrating = false;
  const base = state.vision.calibrate(state.calBuf);
  btn.disabled = mbtn.disabled = false;
  btn.textContent = base ? '기준자세 다시 잡기' : '기준자세 잡기 (3초)';
  mbtn.textContent = base ? '기준 재설정' : '기준자세';
  $('#engineNote').textContent = base
    ? '기준자세를 저장했습니다. 이 자세를 기준으로 시선 이탈·어깨 기울기·흔들림을 계산합니다.'
    : '얼굴이 충분히 잡히지 않았습니다. 조명을 밝게 하고 얼굴 전체가 화면에 들어오게 한 뒤 다시 시도해 주세요.';
}

function pickMime() {
  const cands = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  for (const c of cands) if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  return '';
}

function startRecording() {
  const mime = pickMime();
  state.chunks = [];
  try {
    state.rec = new MediaRecorder(state.stream, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined);
  } catch (e) { $('#engineNote').textContent = '이 브라우저에서는 녹화를 지원하지 않습니다: ' + e.message; return; }
  state.rec.ondataavailable = e => { if (e.data && e.data.size) state.chunks.push(e.data); };
  state.rec.onstop = finishRecording;

  state.t0 = performance.now();
  state.recording = true;
  if (state.vision) state.vision.reset();
  state.audio.stop(); state.audio.start(state.t0);
  if ($('#optStt').checked) {
    state.stt = new Transcriber();
    state.stt.onupdate = (fin, itm) => { $('#caption').textContent = (fin.slice(-60) + ' ' + itm).trim(); };
    state.stt.start(state.t0);
    if (!state.stt.supported) $('#caption').textContent = '이 브라우저는 한국어 음성인식을 지원하지 않습니다 (말속도·군말 항목 제외).';
  } else state.stt = null;

  state.rec.start(250);
  $('#recDot').classList.add('on');
  $('#btnRec').disabled = true; $('#btnStop').disabled = false; $('#btnCal').disabled = true;
  $('#optPose').disabled = true; $('#optStt').disabled = true;
  $('#mShoot').classList.add('on'); $('#mCal').disabled = true;
  document.body.classList.remove('sheet-open');
  acquireWakeLock();
  startTeleprompter();
}

function stopRecording() {
  if (!state.recording) return;
  state.recording = false;
  state.duration = (performance.now() - state.t0) / 1000;
  try { state.rec.stop(); } catch (e) {}
  state.audio.stop();
  if (state.stt) state.stt.stop();
  stopTeleprompter();
  $('#recDot').classList.remove('on');
  $('#btnRec').disabled = false; $('#btnStop').disabled = true; $('#btnCal').disabled = false;
  $('#optPose').disabled = false; $('#optStt').disabled = false;
  $('#mShoot').classList.remove('on'); $('#mCal').disabled = false;
  releaseWakeLock();
}

function finishRecording() {
  const type = state.chunks[0] ? state.chunks[0].type : 'video/webm';
  state.blob = new Blob(state.chunks, { type });
  if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
  state.blobUrl = URL.createObjectURL(state.blob);
  buildReport();
}

function exitStudio() {
  if (state.recording && !confirm('녹화 중입니다. 중단하고 나갈까요?')) return;
  if (state.recording) { state.recording = false; try { state.rec.stop(); } catch (e) {} state.audio.stop(); if (state.stt) state.stt.stop(); }
  stopTeleprompter();
  releaseWakeLock();
  if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
  if (state.audio) { state.audio.close(); state.audio = null; }
  $('#preview').srcObject = null;
  $('#placeholder').classList.remove('hidden');
  $('#recDot').classList.remove('on');
  $('#mShoot').classList.remove('on');
  $('#btnCam').disabled = false; $('#btnCam').textContent = '카메라 켜기';
  $('#btnCal').disabled = true; $('#btnRec').disabled = true; $('#btnStop').disabled = true;
  $('#mCal').disabled = true;
  document.body.classList.remove('live', 'sheet-open');
}

/* ────────────────────────────── 홈 화면에 추가 ────────────────────────────── */
function setupInstall() {
  const box = $('#installTip'), how = $('#installHow');
  if (IS_STANDALONE || localStorage.getItem('speaklab.installTip') === 'off') return;
  if (IS_IOS) {
    how.innerHTML = '사파리 아래 <kbd>공유</kbd> 버튼을 누르고 <kbd>홈 화면에 추가</kbd>를 고르세요. ' +
      '아이콘이 생기고 주소창 없이 전체화면으로 열립니다. (사파리에서 열어야 이 메뉴가 나옵니다)';
    box.classList.add('show');
  } else if (IS_PHONE) {
    how.innerHTML = '크롬 오른쪽 위 <kbd>⋮</kbd> 메뉴에서 <kbd>홈 화면에 추가</kbd>를 고르세요.';
    box.classList.add('show');
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      how.innerHTML = '';
      const b = document.createElement('button');
      b.className = 'btn sm'; b.textContent = '홈 화면에 추가';
      b.onclick = () => { e.prompt(); box.classList.remove('show'); };
      how.appendChild(b);
    });
  }
  $('#installClose').onclick = () => { box.classList.remove('show'); localStorage.setItem('speaklab.installTip', 'off'); };
}

/* ────────────────────────────── 프롬프터 ────────────────────────────── */
let teleTimer = null;
function startTeleprompter() {
  const box = $('#tele'), inner = $('#teleInner');
  if (!state.script.trim()) { box.classList.add('off'); return; }
  box.classList.remove('off');
  inner.textContent = state.script;
  let y = 0;
  inner.style.transform = 'translateY(0px)';
  teleTimer = setInterval(() => {
    const sp = +$('#teleSpeed').value;
    if (!sp) return;
    y += sp * 0.35;
    if (y > inner.scrollHeight) y = -box.clientHeight * 0.6;
    inner.style.transform = `translateY(${-y}px)`;
  }, 60);
}
function stopTeleprompter() { clearInterval(teleTimer); teleTimer = null; }

/* ────────────────────────────── 리포트 ────────────────────────────── */
function buildReport() {
  const dur = state.duration;
  const A = state.audio ? state.audio.summary(dur) : null;
  const V = state.vision && state.vision.ready ? state.vision.summary(dur) : null;
  const sttOk = state.stt && state.stt.supported && state.stt.syllables() > 3;
  const sttData = sttOk ? { syll: state.stt.syllables(), fillers: state.stt.fillerHits.length, speakingTime: A ? A.speakingTime : dur } : null;

  const values = collectValues(A, V, sttData, dur);
  const ev = evaluate(state.cat, values);
  state.report = { cat: state.cat, dur, values, ev, A, V, sttData, at: Date.now() };

  const cat = CATEGORIES[state.cat];
  const missing = [];
  if (!V) missing.push('영상(시선·자세·표정)');
  if (!A || !A.enough) missing.push('음성(성량·억양·쉼) — 말소리가 거의 잡히지 않았습니다');
  if (!sttData) missing.push('말속도·군말');
  $('#reportSub').innerHTML =
    `${cat.icon} <b>${cat.name}</b> 기준 · 길이 ${fmtTime(dur)} · 말한 시간 ${A ? fmtTime(A.speakingTime) : '–'}` +
    (missing.length ? ` · <span style="color:var(--warn)">측정 제외: ${missing.join(', ')}</span>` : '');

  renderGauge(ev.total);
  const vd = verdict(ev.total ?? 0);
  $('#verdictTitle').textContent = ev.total === null ? '측정된 지표가 없습니다' : `${ev.total}점 — ${vd.title}`;
  $('#verdictText').textContent = ev.total === null
    ? '녹화가 너무 짧거나 소리가 잡히지 않았습니다. 5초 이상, 마이크 권한을 허용한 상태로 다시 시도해 주세요.'
    : vd.desc;

  renderMetrics(ev);
  renderTips(buildTips(state.cat, ev));
  const events = buildEvents(A, V);
  renderTimeline(events, A, dur);

  const pb = $('#playback');
  pb.src = state.blobUrl || '';
  const ext = (state.blob && state.blob.type.includes('mp4')) ? 'mp4' : 'webm';
  const dl = $('#dlVideo');
  dl.href = state.blobUrl || '#';
  dl.download = `speaklab_${cat.name}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.${ext}`;

  $('#transcript').textContent = sttOk ? state.stt.text.trim() : '(음성인식 결과 없음)';

  if (ev.total !== null) saveHistory(ev, values, dur);
  setStep(4);
}

function renderGauge(total) {
  const t = total ?? 0;
  const R = 70, C = 2 * Math.PI * R;
  $('#gauge').innerHTML = `
    <svg width="170" height="170" viewBox="0 0 170 170">
      <circle cx="85" cy="85" r="${R}" fill="none" stroke="#1c2230" stroke-width="14"/>
      <circle cx="85" cy="85" r="${R}" fill="none" stroke="${scColor(t)}" stroke-width="14" stroke-linecap="round"
              stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - t / 100)}"/>
    </svg>
    <div class="val"><b style="color:${scColor(t)}">${total === null ? '–' : t}</b><span>100점 만점</span></div>`;
}

function renderMetrics(ev) {
  if (!ev.rows.length) { $('#metricGrid').innerHTML = '<p class="empty">측정된 지표가 없습니다.</p>'; return; }
  $('#metricGrid').innerHTML = ev.rows.map(r => {
    const M = METRICS[r.key];
    const [smin, smax] = M.scale;
    const pos = v => Math.max(0, Math.min(100, (v - smin) / (smax - smin) * 100));
    const bl = pos(r.band[0]), bh = pos(r.band[1]);
    const dp = pos(r.value);
    return `<div class="metric">
      <div class="top"><b>${M.label}</b><em>${M.fmt(r.value)}${M.unit} <span class="sc" style="color:${scColor(r.score)}">${Math.round(r.score)}점</span></em></div>
      <div class="track">
        <div class="base"></div>
        <div class="band" style="left:${bl}%;width:${Math.max(2, bh - bl)}%"></div>
        <div class="dot" style="left:${dp}%;background:${scColor(r.score)}"></div>
      </div>
      <p class="note">목표 ${M.fmt(r.band[0])}~${M.fmt(r.band[1])}${M.unit} · 반영 비중 ${Math.round(r.wNorm * 100)}%</p>
    </div>`;
  }).join('');
}

function renderTips(tips) {
  $('#tipList').innerHTML = tips.map(t => `<div class="tip ${t.good ? 'good' : ''}"><b>${t.title}</b><p>${t.body}</p></div>`).join('');
}

function buildEvents(A, V) {
  const ev = [];
  if (V) {
    for (const o of V.offs) ev.push({ t: o.t, level: 'bad', label: `시선 이탈 ${o.d.toFixed(1)}초` });
    for (const s of V.swayBursts) ev.push({ t: s.t, level: 'info', label: `상체 흔들림 (얼굴폭의 ${Math.round(s.range)}%)` });
  }
  if (A) for (const p of A.longPauses) ev.push({ t: p.t, level: 'warn', label: `긴 침묵 ${p.d.toFixed(1)}초` });
  if (state.stt) for (const f of state.stt.fillerHits) ev.push({ t: f.t, level: 'warn', label: `군말 “${f.word}”` });
  return ev.sort((a, b) => a.t - b.t);
}

function renderTimeline(events, A, dur) {
  const tl = $('#timeline');
  const pct = t => Math.max(0, Math.min(100, t / Math.max(dur, .001) * 100));
  let html = '';
  if (A) for (const s of A.segs) html += `<div class="seg" style="left:${pct(s.t)}%;width:${Math.max(.4, pct(s.t + s.d) - pct(s.t))}%"></div>`;
  for (const e of events) html += `<div class="mk ${e.level}" style="left:${pct(e.t)}%" title="${e.label}"></div>`;
  html += '<div class="ax">' + [0, .25, .5, .75, 1].map(f => `<i style="left:${f * 100}%">${fmtTime(dur * f)}</i>`).join('') + '</div>';
  tl.innerHTML = html;
  tl.onclick = e => {
    const r = tl.getBoundingClientRect();
    seekTo((e.clientX - r.left) / r.width * dur);
  };
  $('#evList').innerHTML = events.length
    ? events.map(e => `<div class="ev" data-t="${e.t.toFixed(2)}"><time>${fmtTime(e.t)}</time><span style="color:${e.level === 'bad' ? 'var(--bad)' : e.level === 'warn' ? 'var(--warn)' : 'var(--info)'}">●</span><span>${e.label}</span></div>`).join('')
    : '<p class="empty">지적할 만한 순간이 없었습니다.</p>';
  $$('#evList .ev').forEach(el => el.onclick = () => seekTo(+el.dataset.t));
}
function seekTo(t) {
  const pb = $('#playback');
  pb.currentTime = Math.max(0, t - 0.8);
  pb.play().catch(() => {});
  pb.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function reportText() {
  const r = state.report;
  if (!r) return '';
  const c = CATEGORIES[r.cat];
  let s = `SPEAK LAB 연습 리포트\n${new Date(r.at).toLocaleString('ko-KR')}\n카테고리: ${c.name}\n길이: ${fmtTime(r.dur)}\n종합: ${r.ev.total}점\n\n[지표별]\n`;
  for (const row of r.ev.rows) {
    const M = METRICS[row.key];
    s += `- ${M.label}: ${M.fmt(row.value)}${M.unit} (목표 ${M.fmt(row.band[0])}~${M.fmt(row.band[1])}${M.unit}) → ${Math.round(row.score)}점\n`;
  }
  s += '\n[코칭]\n';
  for (const t of buildTips(r.cat, r.ev)) s += `- ${t.title}\n  ${t.body}\n`;
  if (state.stt && state.stt.text) s += `\n[받아쓰기]\n${state.stt.text.trim()}\n`;
  return s;
}

/* ────────────────────────────── 기록 ────────────────────────────── */
const HKEY = 'speaklab.history.v1';
function loadHistory() { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } }
function saveHistory(ev, values, dur) {
  const h = loadHistory();
  h.push({ at: Date.now(), cat: state.cat, total: ev.total, dur, v: values });
  localStorage.setItem(HKEY, JSON.stringify(h.slice(-40)));
  renderHistory();
}
function renderHistory() {
  const h = loadHistory();
  const list = $('#histList');
  if (!h.length) { list.innerHTML = '<p class="empty">아직 기록이 없습니다.</p>'; $('#spark').innerHTML = ''; return; }
  list.innerHTML = [...h].reverse().slice(0, 12).map(r => `
    <div class="hrow">
      <span class="s" style="color:${scColor(r.total)}">${r.total}</span>
      <span>${CATEGORIES[r.cat] ? CATEGORIES[r.cat].icon + ' ' + CATEGORIES[r.cat].name : r.cat}</span>
      <time>${new Date(r.at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${fmtTime(r.dur)}</time>
    </div>`).join('');
  const pts = h.slice(-12);
  if (pts.length > 1) {
    const step = 600 / (pts.length - 1);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(44 - p.total / 100 * 40).toFixed(1)}`).join(' ');
    $('#spark').innerHTML = `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2"/>` +
      pts.map((p, i) => `<circle cx="${(i * step).toFixed(1)}" cy="${(44 - p.total / 100 * 40).toFixed(1)}" r="3" fill="${scColor(p.total)}"/>`).join('');
  } else $('#spark').innerHTML = '';
}

/* ────────────────────────────── 연결 ────────────────────────────── */
function init() {
  renderCats();
  renderHistory();
  setStep(1);

  $('#toStep2').onclick = () => { renderPrompts(); setStep(2); };
  $('#backTo1').onclick = () => setStep(1);
  $('#backTo2').onclick = () => setStep(2);
  $('#toStep3').onclick = () => {
    state.script = $('#scriptBox').value;
    renderFocus();
    setStep(3);
    if (!state.vision && state.visionMode === 'loading') initVision();
  };

  $('#btnCam').onclick = startCamera;
  $('#btnCal').onclick = calibrate;
  $('#btnRec').onclick = startRecording;
  $('#btnStop').onclick = stopRecording;

  // 모바일 조작 바
  $('#mCal').onclick = calibrate;
  $('#mShoot').onclick = () => (state.recording ? stopRecording() : startRecording());
  $('#mSet').onclick = () => document.body.classList.toggle('sheet-open');
  const closeSheet = () => document.body.classList.remove('sheet-open');
  $('#sheetBack').onclick = closeSheet;
  $('#sheetClose').onclick = closeSheet;
  $('#sheetDone').onclick = closeSheet;
  $('#btnExit').onclick = exitStudio;
  $('#mCal').disabled = true;

  // 폰에서는 자세 모델까지 돌리면 발열·끊김이 심해 기본은 얼굴만 본다
  if (IS_PHONE) $('#optPose').checked = false;

  setupInstall();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  // 녹화 중 화면을 다시 켜면 wake lock을 다시 잡는다
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.recording) acquireWakeLock();
  });

  $('#optMirror').onchange = e => $('#stage').classList.toggle('no-mirror', !e.target.checked);
  $('#optPose').onchange = () => { state.vision = null; state.visionMode = 'loading'; initVision(); };
  $('#teleSpeed').oninput = e => $('#teleSpeedV').textContent = e.target.value;

  $('#dlReport').onclick = () => {
    const blob = new Blob([reportText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `speaklab_report_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };
  $('#againSame').onclick = () => setStep(3);
  $('#againNew').onclick = () => setStep(1);
  $('#clearHist').onclick = () => { if (confirm('연습 기록을 모두 지울까요?')) { localStorage.removeItem(HKEY); renderHistory(); } };

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('#engineNote').innerHTML = '<b>이 브라우저에서는 카메라를 사용할 수 없습니다.</b> Chrome 또는 Edge 최신 버전에서 https 주소로 열어 주세요.';
  }
}
document.addEventListener('DOMContentLoaded', init);

/* 테스트·디버깅용 내부 노출 (앱 동작에는 영향 없음) */
window.__speaklab = { CATEGORIES, METRICS, bandScore, evaluate, collectValues, buildTips, verdict,
  VisionAnalyzer, AudioAnalyzer, Transcriber, state, setStep, renderGauge, renderMetrics, renderTips, renderTimeline };
