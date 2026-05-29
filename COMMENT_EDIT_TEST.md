# 댓글 수정 기능 테스트 가이드

## 구현 완료 ✅

### 1. UI 추가 사항
- ✏️ 댓글 수정 모달 (반응형)
- "수정" 버튼 (3개 위치 모두 추가)
  - 게시물 상세 모달의 댓글
  - 댓글 전용 모달의 댓글
  - 커뮤니티 목록 인라인 댓글

### 2. 함수 구현
```javascript
✅ editComment(fandom, postId, commentId, currentContent)
   - 모달 열기
   - 텍스트 자동 선택

✅ saveEditComment()
   - Firebase 업데이트
   - 토스트 메시지
   - 모달 자동 닫기

✅ closeEditCommentModal()
   - 모달 닫기
   - 상태 초기화
```

## 테스트 절차

### 방법 1: 로컬 테스트 (권장)
```bash
cd docs/
python -m http.server 8080
# http://localhost:8080 접속
```

### 테스트 단계
1. **로그인**
   - Google/Kakao로 로그인

2. **게시물 작성**
   - 커뮤니티 탭
   - "🎤 게시글 작성" 버튼
   - 팬덤 선택 후 게시글 작성

3. **댓글 작성**
   - 작성한 게시글에 댓글 추가

4. **댓글 수정 테스트**
   - 자신의 댓글 옆 "수정" 버튼 클릭
   - ✏️ 댓글 수정 모달 열림 확인
   - 텍스트 수정
   - "저장" 버튼 클릭
   - 댓글이 실시간으로 업데이트되는지 확인

5. **경계값 테스트**
   - [ ] 빈 댓글 수정 시도 → "댓글 내용을 입력해주세요" 메시지 표시
   - [ ] 긴 댓글 (500자 이상) 입력 시도 → maxlength 제약 작동
   - [ ] 다른 사용자의 댓글에 "수정" 버튼이 보이지 않는지 확인

## 기술 상세

### Firebase 업데이트 구조
```
Path: community/{팬덤}/{게시글ID}/comments/{댓글ID}
Update: { content: "수정된 내용" }
```

### 실시간 업데이트 메커니즘
1. `saveEditComment()` → Firebase 업데이트
2. Firebase 리스너 감지
3. 댓글 목록 자동 리렌더링
4. UI 즉시 반영

### 보안
- `isCommentAuthor` 체크로 작성자만 수정 가능
- `escAttr()` / `escHtml()` 함수로 XSS 방지
- 서버 측 권한 체크는 Firebase Rules에서 처리

## 다음 단계

### Step 2: 댓글 정렬 (예정)
- [ ] 댓글 정렬 옵션 추가
  - 최신순 (기본)
  - 인기순 (좋아요 수)
  - 베스트 (평점)

### Step 3: 이미지 업로드 (예정)
- [ ] Cloudinary 연동
- [ ] 댓글/게시글에 이미지 첨부
- [ ] 비용 최적화 (free tier 25GB/month)

## 코드 위치

파일: `/docs/index.html`

| 항목 | 라인 | 내용 |
|------|------|------|
| 모달 HTML | 1650-1668 | editCommentModal div |
| 상태 변수 | 4257-4263 | editCommentState |
| 수정 버튼 1 | 4735 | 게시물 상세 댓글 |
| 수정 버튼 2 | 4825 | 댓글 모달 댓글 |
| 수정 버튼 3 | 5386 | 커뮤니티 인라인 댓글 |
| editComment() | 5446-5458 | 모달 열기 함수 |
| closeEditCommentModal() | 5460-5467 | 모달 닫기 함수 |
| saveEditComment() | 5469-5496 | 저장 함수 |

## 주의사항

⚠️ **Firebase Rules 확인 필요**
```json
현재 구조 예상:
"community": {
  "$팬덤": {
    "$게시글ID": {
      "comments": {
        "$댓글ID": {
          "content": "string",
          "authorUid": "string",
          ".write": "$commentId의 authorUid === auth.uid"
        }
      }
    }
  }
}
```

✅ **테스트 완료 확인 사항**
- [ ] 로그인 후 자신의 댓글 수정 가능
- [ ] 타인의 댓글은 수정 버튼 미표시
- [ ] 수정 후 원본 댓글 실시간 업데이트
- [ ] 빈 댓글 입력 시 에러 메시지 표시
- [ ] 모바일 화면에서도 모달이 올바르게 표시

