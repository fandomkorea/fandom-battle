// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Firebase 설정 & 상수
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

// 그룹 이모지/색상 메타데이터
const GROUP_META = {
  "BTS":               { emoji: "💜", color: "#7c4dff", fandom: "ARMY", kr: "방탄소년단" },
  "BLACKPINK":         { emoji: "🩷", color: "#e91e63", fandom: "BLINK", kr: "블랙핑크" },
  "aespa":             { emoji: "💚", color: "#00897b", fandom: "MY", kr: "에스파" },
  "NewJeans":          { emoji: "🩵", color: "#0288d1", fandom: "Bunnies", kr: "뉴진스" },
  "IVE":               { emoji: "🤍", color: "#78909c", fandom: "DIVE", kr: "아이브" },
  "LE SSERAFIM":       { emoji: "🧡", color: "#e65100", fandom: "FERIKITA", kr: "르세라핌" },
  "SEVENTEEN":         { emoji: "💎", color: "#1976d2", fandom: "CARAT", kr: "세븐틴" },
  "Stray Kids":        { emoji: "⬛", color: "#607d8b", fandom: "STAY", kr: "스트레이 키즈" },
  "TXT":               { emoji: "🌙", color: "#7c4dff", fandom: "MOA", kr: "투모로우 바이 투게더" },
  "ENHYPEN":           { emoji: "🖤", color: "#546e7a", fandom: "ENGENE", kr: "엔하이픈" },
  "TWICE":             { emoji: "🎀", color: "#e91e8c", fandom: "ONCE", kr: "트와이스" },
  "EXO":               { emoji: "⭐", color: "#f57f17", fandom: "EXO-L", kr: "엑소" },
  "NCT 127":           { emoji: "🔴", color: "#e53935", fandom: "NCTzen", kr: "NCT 127" },
  "NCT Dream":         { emoji: "🌈", color: "#43a047", fandom: "NCTzen", kr: "NCT 드림" },
  "WayV":              { emoji: "💛", color: "#f9a825", fandom: "WayZenNi", kr: "웨이브" },
  "ITZY":              { emoji: "💥", color: "#e53935", fandom: "MIDZY", kr: "있지" },
  "NMIXX":             { emoji: "🫧", color: "#1565c0", fandom: "NSWER", kr: "엔믹스" },
  "ZEROBASEONE":       { emoji: "🔵", color: "#1976d2", fandom: "ZEROSE", kr: "제로베이스원" },
  "RIIZE":             { emoji: "🌹", color: "#c2185b", fandom: "BRIIZE", kr: "라이즈" },
  "ATEEZ":             { emoji: "🏴‍☠️", color: "#607d8b", fandom: "ATINY", kr: "에이티즈" },
  "THE BOYZ":          { emoji: "🫐", color: "#3949ab", fandom: "THE B", kr: "더보이즈" },
  "Red Velvet":        { emoji: "🍎", color: "#e53935", fandom: "ReVeluv", kr: "레드벨벳" },
  "Girls' Generation": { emoji: "☀️", color: "#f57f17", fandom: "SONE", kr: "소녀시대" },
  "MAMAMOO":           { emoji: "🌻", color: "#f9a825", fandom: "MOOMOO", kr: "마마무" },
  "SHINEE":            { emoji: "💙", color: "#1976d2", fandom: "SHINee World", kr: "샤이니" },
  "Super Junior":      { emoji: "💙", color: "#1565c0", fandom: "E.L.F.", kr: "슈퍼주니어" },
  "MONSTA X":          { emoji: "🔥", color: "#d84315", fandom: "MONBEBE", kr: "몬스타엑스" },
  "BIGBANG":           { emoji: "👑", color: "#78909c", fandom: "VIP", kr: "빅뱅" },
  "GOT7":              { emoji: "🌿", color: "#388e3c", fandom: "IGOT7", kr: "갓세븐" },
  "ONEUS":             { emoji: "🖤", color: "#1a1a1a", fandom: "RAVN", kr: "오너스" },
  "TREASURE":          { emoji: "💎", color: "#f9a825", fandom: "TREASURE", kr: "트레저" },
  "CRAVITY":           { emoji: "🌙", color: "#2c3e50", fandom: "CARAT", kr: "크래비티" },
  "&TEAM":             { emoji: "💜", color: "#7c4dff", fandom: "FAMILY", kr: "앤드팀" },
  "XDINARY HEROES":    { emoji: "🎸", color: "#d32f2f", fandom: "VILLAINS", kr: "엑스디너리 히어로즈" },
  "TWS":               { emoji: "✨", color: "#0288d1", fandom: "TWINSS", kr: "투어스" },
  "NCT WISH":          { emoji: "🌿", color: "#43a047", fandom: "WISHY", kr: "엔시티 위시" },
  "BOYNEXTDOOR":       { emoji: "🚪", color: "#1565c0", fandom: "BNDCLASS", kr: "보이넥스트도어" },
  "ILLIT":             { emoji: "💫", color: "#9c27b0", fandom: "ILLUMINATION", kr: "아일릿" },
  "BABYMONSTER":       { emoji: "👹", color: "#c41c3b", fandom: "BAEMON", kr: "베이비몬스터" },
  "QWER":              { emoji: "🌈", color: "#ff6f00", fandom: "QWERIC", kr: "큐어" },
  "Hearts2Hearts":     { emoji: "💖", color: "#ec407a", fandom: "HEARTS", kr: "하츠" },
  "KiiiKiii":          { emoji: "✨", color: "#e91e63", fandom: "KIIIS", kr: "키키키" },
  "Baby DONT Cry":     { emoji: "🎀", color: "#c2185b", fandom: "BEAVERS", kr: "베이비돈트크라이" },
  "ALLDAY PROJECT":    { emoji: "🌟", color: "#f57f17", fandom: "ALLDAY", kr: "올데이프로젝트" },
  "IU":                { emoji: "🌸", color: "#c2185b", fandom: "UAENA", kr: "아이유" },
};

const ALL_GROUPS = Object.keys(GROUP_META);

// ── 상수 ──
const ADMIN_PW = "fandom1234";
const isAdmin = new URLSearchParams(location.search).has("admin");

// 투표 제한 (하루 최대: 무료 1표 + 광고 10표 = 11표)
const MAX_FREE_VOTES_PER_DAY = 1;
const MAX_AD_VOTES_PER_DAY = 10;
const MAX_TOTAL_VOTES_PER_DAY = 11;

// 초기 랭킹 표시 개수
const INITIAL_SHOW = 10;

// 최대 활동 피드 항목
const MAX_ACTIVITY_ITEMS = 5;

// ── 전역 변수 ──
let db = null;
let allRankingsData = null;
let showAllRankings = true;

let auth = null;
let currentUser = null;
let isLoggedIn = false;
let currentUserFav = null;

let pendingAdVotes = 0;
let adWatchCount = 0;
let cachedTodayFreeVote = null;
let cachedTodayAdVotes = 0;

let activityQueue = [];
let activityLastRendered = 0;

let lastRankingData = null;
let trendingData = {};

let _cdTimer = null;

let rankingSearchQuery = "";
let currentSortMode = "votes";
let currentCommunityFandom = "BTS";
let currentPostsPerPage = 50;
let currentPage = 1;
let currentCommentFilterGroup = null;
let allPostsData = {};
let postDetailViewerUid = null;

// 커뮤니티 관련
let currentActiveListener = null;
let communityPostsToDisplay = [];
let communityVisibleIndex = 0;
let communityPostsPerLoad = 50;
