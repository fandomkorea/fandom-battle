# 🎮 팬덤배틀 (FandomBattle) - 관리자 가이드

## 📋 목차
1. [사이트 개요](#사이트-개요)
2. [계정 정보](#계정-정보)
3. [배포 및 호스팅](#배포-및-호스팅)
4. [주요 기능](#주요-기능)
5. [유지보수 사항](#유지보수-사항)

---

## 🎯 사이트 개요

**팬덤배틀**은 K-POP 팬덤의 월간 파워 랭킹 투표 사이트입니다.

### 핵심 정보
- **URL**: https://fandombattle.com/
- **이전 URL**: https://fandomkorea.github.io/fandom-battle/ (GitHub Pages)
- **언어**: 한국어
- **타입**: 실시간 투표 & 커뮤니티 사이트
- **메인 파일**: `/docs/index.html` (약 5500줄, 모두 한 파일에 통합)

### 주요 특징
- ✅ **실시간 투표 시스템**: 월간 랭킹 + 일일 투표 제한 (1회 무료 + 광고시청으로 최대 10회)
- ✅ **커뮤니티**: 팬덤별 게시글, 댓글, 좋아요 시스템
- ✅ **로그인**: Google/Kakao OAuth
- ✅ **광고 수익화**: Google AdSense + IMA SDK (준비 중)
- ✅ **모바일 최적화**: 반응형 디자인

---

## 🔑 계정 정보

### GitHub
```
계정명: fandomkorea
이메일: coder.leebeegle2@gmail.com
리포지토리: fandom-battle
URL: https://github.com/fandomkorea/fandom-battle
배포: GitHub Pages (자동 배포)
분기: main
배포 폴더: /docs
```

**중요**: 
- `docs/` 폴더의 모든 변경사항이 자동으로 배포됨
- `git push` 후 ~1분 내 https://fandombattle.com 에 반영
- CNAME 파일이 fandombattle.com 도메인 연결

### Firebase
```
프로젝트명: fandom-battle-92aa8
이메일: coder.leebeegle2@gmail.com
프로젝트 ID: fandom-battle-92aa8
인증 도메인: https://fandombattle.com

Realtime Database URL:
https://fandom-battle-92aa8-default-rtdb.firebaseio.com

데이터 구조:
├── users/
│   └── {uid}/
│       ├── nickname (닉네임)
│       ├── preferences/
│       │   └── primaryFandom (최애팬덤)
│       ├── votingStreak (연속투표일수)
│       ├── pendingAdVotes (광고투표권)
│       ├── ad_watch_count_{date} (일일 광고시청횟수)
│       └── ad_votes_used_{date} (일일 광고투표 사용)
│
├── votes/
│   └── {date}/
│       └── {uid} (당일 투표 기록)
│
├── battleGroups/
│   └── {그룹명}/
│       ├── totalVotes (누적투표)
│       ├── monthlyVotes (월간투표)
│       └── posts/{postId}
│
└── community/
    └── {팬덤명}/
        └── posts/
            └── {postId}
```

**Firebase Console**: https://console.firebase.google.com/

### Gavia (도메인 등록)
```
도메인: fandombattle.com
등록사: Gavia (가비아)
이메일: coder.leebeegle2@gmail.com
등록기간: 1년
갱신일: 자동 확인 필요

DNS 설정: A 레코드
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

**Gavia Console**: https://www.gabia.com

### Google AdSense
```
게시자 계정: ca-pub-3646896464963069
계정명: fandombattle.com
이메일: coder.leebeegle2@gmail.com
상태: 승인 대기 중 (약 24시간)

ads.txt 파일 위치: /docs/ads.txt
내용: google.com, pub-3646896464963069, DIRECT, f08c47fec0942fa0
```

**AdSense Console**: https://adsense.google.com

### Google Ad Manager (준비 중)
```
상태: AdSense 승인 후 진행 예정
계획된 기능:
- 리워드 광고 (VAST URL 기반)
- 동영상 광고 플레이어 (IMA SDK)
- 투표권 보상 시스템
```

---

## 📡 배포 및 호스팅

### 배포 흐름

```
로컬 수정 (docs/index.html)
    ↓
git add → git commit → git push
    ↓
GitHub 자동 배포
    ↓
~1분 후 https://fandombattle.com 반영
```

### 주요 파일

| 파일 | 용도 |
|------|------|
| `/docs/index.html` | **메인 파일** (HTML + CSS + JS 모두 포함) |
| `/docs/CNAME` | GitHub Pages 커스텀 도메인 설정 |
| `/docs/ads.txt` | Google AdSense 인증 파일 |
| `/docs/og-image.png` | 소셜 미디어 공유 이미지 |
| `/.gitignore` | Git 추적 제외 파일 |

### 배포 설정

**GitHub Pages Settings**:
- 소스: main branch / /docs folder
- 커스텀 도메인: fandombattle.com
- HTTPS: 강제 (자동 발급)

---

## 🎮 주요 기능

### 1. 투표 시스템
```javascript
// 일일 투표 제한
- 무료 투표: 1회/일
- 광고 투표: 최대 10회/일 (광고시청으로 획득)
- 총 최대: 11회/일

// 자동 초기화
- 자정(00:00)마다 getTodayKey() 날짜 변경
- Firebase에서 새 날짜로 투표 데이터 조회
- 이전 날짜 데이터 없음 = 자동 리셋
```

### 2. 팬덤 변경
```javascript
// 제약사항
- 게시글 작성: 24시간 금지
- 투표: 48시간 금지
- 변경 시 경고 모달 표시
```

### 3. 커뮤니티
```javascript
// 정렬 옵션 (가로 버튼)
- 📅 최신순 (기본값)
- ⭐ 인기순
- 🏆 베스트

// 기능
- 게시글 작성 (최애팬덤별)
- 댓글 시스템
- 좋아요/추천
- 신고 시스템
```

### 4. 로그인
```javascript
// 제공자
- Google OAuth
- Kakao OAuth

// 저장되는 정보
- uid (고유ID)
- nickname (닉네임)
- primaryFandom (최애팬덤)
- lastFandomChangeTime (마지막 팬덤 변경시간)
- votingStreak (연속투표일수)
```

---

## 🛠️ 유지보수 사항

### 정기 확인 사항

#### 월간
- [ ] Firebase Realtime Database 용량 확인
- [ ] Google AdSense 수익 현황
- [ ] 월간 랭킹 수상자 확인

#### 분기별
- [ ] GitHub 저장소 상태 점검
- [ ] 사용자 피드백 검토
- [ ] 보안 업데이트 확인

#### 연간
- [ ] Gavia 도메인 갱신 (자동 갱신 설정 권장)
- [ ] Google AdSense 계정 유지

### 주의사항

⚠️ **Google Ad Manager 구현 대기 중**
- AdSense 승인 필요
- VAST URL 및 IMA SDK 통합 필요
- watchAd() 함수 수정 필요

⚠️ **Firebase CORS 설정**
- 새 도메인 추가 시 Firebase 콘솔에서 승인된 도메인 추가 필수
- 현재: fandombattle.com (등록됨)

⚠️ **GitHub Pages 주의**
- `/docs` 폴더만 배포됨
- 다른 폴더의 파일은 배포되지 않음
- CNAME 파일 삭제 금지

### 긴급 대응

**사이트 접속 불가**
1. GitHub Pages 상태 확인: https://www.githubstatus.com
2. DNS 전파 확인: https://dnschecker.org (fandombattle.com)
3. Firebase 상태 확인: https://status.firebase.google.com
4. 브라우저 캐시 삭제 후 재시도

**게시글/투표 데이터 손실**
- Firebase Realtime Database 백업 확인
- 최근 백업에서 복구 (필요시)

---

## 📊 기술 스택

| 항목 | 기술 |
|------|------|
| 프론트엔드 | HTML5 + CSS3 + Vanilla JavaScript |
| 백엔드 | Firebase Realtime Database |
| 인증 | Firebase Authentication (Google/Kakao OAuth) |
| 호스팅 | GitHub Pages |
| 도메인 | Gavia |
| 광고 | Google AdSense + IMA SDK (준비 중) |
| 버전 관리 | Git + GitHub |

---

## 📝 로그인 정보 요약

| 서비스 | 계정 | URL |
|--------|------|------|
| **GitHub** | fandomkorea | https://github.com |
| **Firebase** | coder.leebeegle2@gmail.com | https://console.firebase.google.com |
| **Gavia** | coder.leebeegle2@gmail.com | https://www.gabia.com |
| **Google AdSense** | coder.leebeegle2@gmail.com | https://adsense.google.com |
| **도메인** | fandombattle.com | https://www.gabia.com |

---

## 🚀 다음 단계

1. **Google AdSense 승인 대기** (현재)
   - 승인 이메일 받으면 알림 설정
   
2. **Google Ad Manager 설정**
   - AdSense 승인 후 GAM 계정 생성
   - 광고 유닛 생성 (리워드 광고)
   - VAST URL 생성

3. **IMA SDK 통합**
   - watchAd() 함수 수정
   - VAST URL 적용
   - 광고 재생 테스트

4. **라이브 런칭**
   - 테스트 완료 후 실제 광고 활성화

---

**마지막 업데이트**: 2026-05-25
**관리자**: 리빙
**버전**: 1.0 (도메인 이전 + AdSense 적용 준비 완료)
