# 연대기별 성경통독 일정표

첨부된 `chronological_365_days_full.xlsx`의 Day 001~Day 365 데이터를 앱 내부 JSON으로 변환한 React Native / Expo 앱입니다.

## 구현된 기능

- 첫 실행 시 Day 001 자동 표시
- 완료 버튼을 눌러야 다음 Day로 이동
- 완료 시 휴대폰 현지 완료일시 저장
- 완료하지 않고 앱을 종료하면 다음 실행 때 같은 Day 유지
- 완료 기록 화면에서 Day, 완료일시, 성경 범위 조회
- 전체 진행률 표시
- Android 종료 버튼 지원
- iPhone은 운영체제 정책상 앱 자체 강제 종료 대신 홈 화면 이동 안내
- 모든 진행 기록은 기기 로컬 AsyncStorage에 저장

## 실행

Node.js 22.13 이상을 설치한 뒤 프로젝트 폴더에서:

```bash
npm install
npx expo start
```

휴대폰 테스트는 QR 코드 또는 Android 에뮬레이터를 사용할 수 있습니다.

## Android APK 만들기

Expo 계정에 로그인한 뒤:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

`eas.json`의 preview 프로필은 APK 설치 파일을 만들도록 설정되어 있습니다.

## 앱 데이터

`assets/schedule.json`에 엑셀의 365일 일정이 들어 있습니다.
