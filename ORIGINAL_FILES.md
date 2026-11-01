# 원어 파일 가져오기 (1.3.22)

성경보기에서 원어 코드·사전 JSON 가져오기를 누르고 폴더를 선택합니다. 모든 JSON을 검증한 뒤 이전 원어 묶음을 새 묶음으로 교체합니다. 취소·검증 실패 시 이전 자료는 유지됩니다. 성경 번역본은 별도로 등록해야 합니다.

지원 형식은 gf-bible-original-v1 JSON입니다. 실제 사용자 원어 파일은 미제공이므로 기존 BDF/_s/사전과의 호환은 확인하지 않았습니다. 실제 필드·인코딩·구절 연결을 확인한 뒤 변환기 추가가 필요합니다. 성경·사전 본문은 포함하지 않습니다.

코드 파일 예시(가상 연결이며 실제 성경 코드 아님):
```json
{"format":"gf-bible-original-v1","type":"codes","translationId":"KRV","verses":[{"book":"Genesis","chapter":1,"verse":1,"codes":["H1"]}]}
```
사전 파일 예시:
```json
{"format":"gf-bible-original-v1","type":"dictionary","entries":{"H1":{"lemma":"원어 표제어","transliteration":"발음 표기","meaning":"사용자가 제공한 뜻"}}}
```
translationId는 등록된 번역본 ID와 일치해야 합니다. book은 assets/bible-books.json의 영문 book, chapter/verse는 1 이상의 정수, codes는 H/G로 시작하는 스트롱 번호 배열입니다. 본문 아래 코드를 누르면 사전을 표시합니다. 자료는 해당 기기에만 저장됩니다.
