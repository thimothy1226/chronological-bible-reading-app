# GF Bible v1.3.0 GitHub 작업 브랜치

이 브랜치는 ChatGPT 작업 #001~#012에서 정리한 GF Bible v1.3.0 최종 소스 반영을 위해 만든 작업 브랜치입니다.

## 브랜치

- 브랜치명: `gf-bible-v1.3.0-final-source`
- 기준 커밋: `87fa63b86e17491f956223d94a1efce91d0a1884`

## 반영 예정 주요 내용

- 관리자 로그인 복구 로직
- 공지/중보기도 푸시 알림 개선
- 알림 클릭 시 게시글 상세 이동
- 호몰로기아 상단 Safe Area 보정
- 성경보기 하단 잘림 보정
- 앱 아이콘/스플래시 추가
- 형광펜/북마크/메모 보관함 기능
- Google Play 문의 이메일/정책 문서 정리
- 빌드/배포/최종 점검 스크립트 추가

## 운영자 문의 정보

- 운영자: 다락방
- 이메일: thimothy1226@naver.com

## 다음 단계

ChatGPT에서 전달된 `GF-Bible-work012-final-handoff.zip` 안의 파일들을 이 브랜치에 업로드한 뒤 Pull Request를 만들고 GitHub Actions에서 APK를 빌드합니다.

Firebase Functions와 Firestore Rules는 APK 빌드와 별도로 배포해야 합니다.

```bash
firebase deploy --only functions,firestore:rules
```
