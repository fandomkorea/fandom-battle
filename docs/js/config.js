// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Firebase 설정 — 아래 값을 본인 프로젝트 값으로 교체하세요
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
const firebaseConfig = {
  apiKey: "AIzaSyAzUVrCc7-gmdYyXu0wFBm8XRi-1OHb2r4",
  authDomain: "fandom-battle-92aa8.firebaseapp.com",
  databaseURL: "https://fandom-battle-92aa8-default-rtdb.firebaseio.com",
  projectId: "fandom-battle-92aa8",
  storageBucket: "fandom-battle-92aa8.firebasestorage.app",
  messagingSenderId: "9287384303",
  appId: "1:9287384303:web:9e9fded2e119ae2a33af1a"
};

/*
Firebase Rules를 Firebase Console에서 다음과 같이 설정하세요:
{
  "rules": {
    "votes": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$date": {
        ".read": "auth != null",
        ".write": "auth != null",
        "$uid": {
          ".write": "$uid === auth.uid",
          ".validate": "newData.hasChildren(['group', 'timestamp'])"
        }
      }
    },
    "rankings": {
      ".read": true,
      ".write": false
    },
    "users": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "nickname": { ".validate": "newData.isString() && newData.val().length > 0" },
        "fandom": { ".validate": "newData.isString()" },
        "pendingPaidVotes": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000" }
      }
    },
    "community": {
      ".read": true,
      ".write": "auth != null"
    },
    "group_records": {
      ".read": true,
      ".write": false
    },
    "monthly_history": {
      ".read": true,
      ".write": false
    },
    "prize_notice": {
      ".read": true,
      ".write": false
    }
  }
}
*/

// 그룹 이모지/색상 메타데이터
const GROUP_META = {
  // ── 3세대 (현재도 활동 중) ──
  "BTS":               { emoji: "💜", color: "#7c4dff", fandom: "ARMY",        kr: "방탄소년단" },
  "BLACKPINK":         { emoji: "🩷", color: "#e91e63", fandom: "BLINK",       kr: "블랙핑크" },
  "TWICE":             { emoji: "🎀", color: "#e91e8c", fandom: "ONCE",        kr: "트와이스" },
  "EXO":               { emoji: "⭐", color: "#f57f17", fandom: "EXO-L",       kr: "엑소" },
  "SHINEE":            { emoji: "🩵", color: "#00BCD4", fandom: "SHINee World", kr: "샤이니" },
  "Red Velvet":        { emoji: "🍎", color: "#e53935", fandom: "ReVeluv",     kr: "레드벨벳" },
  "MONSTA X":          { emoji: "🔥", color: "#d84315", fandom: "MONBEBE",     kr: "몬스타엑스" },
  "SEVENTEEN":         { emoji: "💎", color: "#1976d2", fandom: "CARAT",       kr: "세븐틴" },
  "ATEEZ":             { emoji: "🏴‍☠️", color: "#607d8b", fandom: "ATINY",   kr: "에이티즈" },
  "THE BOYZ":          { emoji: "🫐", color: "#3949ab", fandom: "THE B",       kr: "더보이즈" },
  "Stray Kids":        { emoji: "⬛", color: "#607d8b", fandom: "STAY",        kr: "스트레이 키즈" },
  "BTOB":              { emoji: "🎤", color: "#0d47a1", fandom: "MELODY",      kr: "비투비" },
  "ONEUS":             { emoji: "🖤", color: "#1a1a1a", fandom: "RAVN",        kr: "오너스" },
  "VICTON":            { emoji: "🌠", color: "#283593", fandom: "ALICE",       kr: "빅톤" },
  "SF9":               { emoji: "🌟", color: "#e65100", fandom: "FANTASY",     kr: "에스에프나인" },
  "PENTAGON":          { emoji: "⬠", color: "#6a1b9a", fandom: "Universe",    kr: "펜타곤" },
  "VERIVERY":          { emoji: "💙", color: "#7b1fa2", fandom: "VERRER",      kr: "베리베리" },
  "DAY6":              { emoji: "🎸", color: "#1565c0", fandom: "My Day",      kr: "데이식스" },
  "Oh My Girl":        { emoji: "🌺", color: "#26c6da", fandom: "Miracle",     kr: "오마이걸" },
  "DREAMCATCHER":      { emoji: "🕸️", color: "#4a148c", fandom: "Dreamcatcher", kr: "드림캐쳐" },
  "VIVIZ":             { emoji: "💫", color: "#43a047", fandom: "ALICE",       kr: "비비지" },
  "(G)I-DLE":          { emoji: "🔥", color: "#9c27b0", fandom: "NEVERLAND",   kr: "(여자)아이들" },

  // ── 4세대 ──
  "aespa":             { emoji: "💚", color: "#00897b", fandom: "MY",          kr: "에스파" },
  "NewJeans":          { emoji: "🩵", color: "#0288d1", fandom: "Bunnies",     kr: "뉴진스" },
  "IVE":               { emoji: "🤍", color: "#78909c", fandom: "DIVE",        kr: "아이브" },
  "LE SSERAFIM":       { emoji: "🧡", color: "#e65100", fandom: "FERIKITA",    kr: "르세라핌" },
  "TXT":               { emoji: "🌙", color: "#7c4dff", fandom: "MOA",         kr: "투모로우 바이 투게더" },
  "ENHYPEN":           { emoji: "🖤", color: "#546e7a", fandom: "ENGENE",      kr: "엔하이픈" },
  "NCT 127":           { emoji: "💚", color: "#39FF14", fandom: "NCTzen",      kr: "NCT 127" },
  "NCT Dream":         { emoji: "🌈", color: "#43a047", fandom: "NCTzen",      kr: "NCT Dream" },
  "WayV":              { emoji: "💛", color: "#f9a825", fandom: "WayZenNi",    kr: "웨이브" },
  "ITZY":              { emoji: "💥", color: "#e53935", fandom: "MIDZY",       kr: "있지" },
  "NMIXX":             { emoji: "🫧", color: "#1565c0", fandom: "NSWER",       kr: "엔믹스" },
  "ZEROBASEONE":       { emoji: "🔵", color: "#1976d2", fandom: "ZEROSE",      kr: "제로베이스원" },
  "RIIZE":             { emoji: "🌹", color: "#c2185b", fandom: "BRIIZE",      kr: "라이즈" },
  "TREASURE":          { emoji: "💎", color: "#f9a825", fandom: "TREASURE",    kr: "트레저" },
  "CRAVITY":           { emoji: "🌙", color: "#2c3e50", fandom: "LOVEBIRD",    kr: "크래비티" },
  "&TEAM":             { emoji: "💜", color: "#7c4dff", fandom: "FAMILY",      kr: "앤드팀" },
  "XDINARY HEROES":    { emoji: "🎸", color: "#d32f2f", fandom: "VILLAINS",    kr: "엑스디너리 히어로즈" },
  "Kep1er":            { emoji: "🪐", color: "#7b1fa2", fandom: "Kep1ian",     kr: "케플러" },
  "fromis_9":          { emoji: "🌸", color: "#ff7043", fandom: "FROM",        kr: "프로미스나인" },
  "KISS OF LIFE":      { emoji: "💋", color: "#e91e63", fandom: "KISS ME",     kr: "키스오브라이프" },
  "Billlie":           { emoji: "🦋", color: "#5e35b1", fandom: "belllie've",  kr: "빌리" },
  "tripleS":           { emoji: "🔺", color: "#e65100", fandom: "tripleS",     kr: "트리플에스" },
  "TEMPEST":           { emoji: "⚡", color: "#1976d2", fandom: "TEMPERZ",     kr: "템페스트" },
  "XIKERS":            { emoji: "🎯", color: "#d84315", fandom: "XIKERSONE",   kr: "싸이커스" },
  "PLAVE":             { emoji: "🤖", color: "#1e88e5", fandom: "NAVI",        kr: "플레이브" },
  "P1Harmony":         { emoji: "🌟", color: "#00838f", fandom: "P1ECE",       kr: "피원하모니" },
  "TWS":               { emoji: "✨", color: "#0288d1", fandom: "TWINSS",      kr: "투어스" },
  "NCT WISH":          { emoji: "🌿", color: "#43a047", fandom: "WISHY",       kr: "NCT WISH" },

  // ── 5세대 ──
  "BOYNEXTDOOR":       { emoji: "🚪", color: "#1565c0", fandom: "BNDCLASS",    kr: "보이넥스트도어" },
  "ILLIT":             { emoji: "💫", color: "#9c27b0", fandom: "ILLUMINATION", kr: "아일릿" },
  "BABYMONSTER":       { emoji: "👹", color: "#c41c3b", fandom: "BAEMON",      kr: "베이비몬스터" },
  "UNIS":              { emoji: "🌙", color: "#c62828", fandom: "UNIS",        kr: "유니스" },
  "IZNA":              { emoji: "⭐", color: "#ec407a", fandom: "IZNA",        kr: "아이즈나" },
  "QWER":              { emoji: "🎵", color: "#ff6f00", fandom: "QWERIC",      kr: "큐어" },
  "Hearts2Hearts":     { emoji: "💖", color: "#ec407a", fandom: "HEARTS",      kr: "하츠" },
  "KiiiKiii":          { emoji: "✨", color: "#e91e63", fandom: "KIIIS",       kr: "키키키" },
  "Baby DONT Cry":     { emoji: "🎀", color: "#c2185b", fandom: "BEAVERS",     kr: "베이비돈트크라이" },
  "ALLDAY PROJECT":    { emoji: "🌟", color: "#f57f17", fandom: "ALLDAY",      kr: "올데이프로젝트" },
};

const ALL_GROUPS = Object.keys(GROUP_META);

// ── 초기화 ──
let db = null;
let allRankingsData = null;
let showAllRankings = true; // ★ 투표 없는 그룹도 항상 펼쳐서 표시
const isAdmin = new URLSearchParams(location.search).has("admin");

