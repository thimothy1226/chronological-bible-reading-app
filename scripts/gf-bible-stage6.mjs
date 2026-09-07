import fs from 'node:fs';

const path = 'App.js';
let source = fs.readFileSync(path, 'utf8');
const replaceAll = (from, to) => { source = source.split(from).join(to); };
const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(from, to);
};

replaceOnce(
  "['3. 휴대폰에만 저장되는 정보', '성경 통독 완료기록, 말씀 메모, 글자 크기와 읽던 위치, 사용자가 직접 등록한 BDF 성경 데이터는 해당 휴대폰에만 저장되며 서버로 전송하지 않습니다.'],",
  "['3. 휴대폰에만 저장되는 정보', '성경 통독 완료기록, 북마크, 형광펜 표시, 말씀 메모, 글자 크기와 읽던 위치, 사용자가 직접 등록한 BDF 성경 데이터는 해당 휴대폰에만 저장되며 서버로 전송하지 않습니다.'],",
  'privacy local data',
);
replaceOnce(
  "['8. 문의 및 변경', '개인정보 관련 문의는 앱 운영자 또는 소속 그룹 관리자에게 해 주세요. 방침이 변경되면 앱 또는 공지사항을 통해 안내합니다.'],",
  "['8. 문의 및 변경', '개인정보 관련 문의: 다락방 · thimothy1226@naver.com\\n소속 그룹 운영과 관련한 사항은 해당 그룹 관리자에게도 문의할 수 있습니다. 방침이 변경되면 앱 또는 공지사항을 통해 안내합니다.'],",
  'privacy contact',
);
replaceOnce(
  "['7. 약관의 변경', '약관이 변경되면 앱 또는 공지사항을 통해 안내합니다. 변경 후 계속 이용하는 경우 변경된 약관에 동의한 것으로 봅니다.'],",
  "['7. 약관의 변경', '약관이 변경되면 앱 또는 공지사항을 통해 안내합니다. 변경 후 계속 이용하는 경우 변경된 약관에 동의한 것으로 봅니다.'],\n      ['8. 운영자 및 문의', '운영자: 다락방\\n이메일: thimothy1226@naver.com'],",
  'terms contact',
);

replaceAll('그룹관리자', '대표관리자');
replaceAll('부관리자', '부대표관리자');
replaceAll('교회·기관 관리', '그룹 관리');
replaceAll('교회·기관 소개', '그룹 소개');
replaceAll('교회·기관 수정', '그룹 수정');
replaceAll('교회·기관 이름', '그룹 이름');
replaceAll('새 교회·기관 만들기', '새 그룹 만들기');
replaceAll('기관 만들기', '그룹 만들기');
replaceAll('공지사항 기관 선택', '공지사항 그룹 선택');
replaceAll('현재 기관', '현재 그룹');
replaceAll('관리할 교회·기관 선택', '관리할 그룹 선택');
replaceAll('같은 이름의 기관', '같은 이름의 그룹');
replaceAll('교회·기관 이름만 입력하세요.', '그룹 이름만 입력하세요.');
replaceAll('교회·기관 이름 (예: 사랑교회)', '그룹 이름 (예: 사랑교회)');

fs.writeFileSync(path, source);
console.log('GF Bible Stage7 contact/terminology patch applied.');
