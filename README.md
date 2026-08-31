# 연대기별 성경통독 일정표 v2

이번 버전에는 다음 기능이 포함됩니다.

- 365일 연대기 통독 일정 전체를 실제 장/절 범위로 정리
- 오늘 읽을 말씀을 터치하면 실제 성경 본문 화면으로 이동
- 개역한글(KRV) 1961 본문을 빌드 시 내려받아 오프라인으로 앱에 포함
- 본문 글자 크기 A-/A+ 조절
- 번역본 선택 구조를 미리 구현해 향후 다른 번역본 추가 가능
- 기존 진행률, 완료 기록, 다음 Day 이동 기능 유지

## 번역본 추가 구조

`assets/bibles/translations.json`에 번역본 메타데이터를 추가하고,
`App.js`의 `BIBLE_DATA`에 데이터 파일을 연결하면 선택 목록에서 사용할 수 있습니다.

현재 활성 번역본: 개역한글(KRV)

## 빌드

GitHub Actions > Build Android APK > Run workflow

빌드 과정에서 `scripts/fetch-bible.mjs`가 공개 개역한글 JSON 데이터를 내려받아
`assets/bibles/krv.json`을 생성한 뒤 Release APK에 포함합니다.
