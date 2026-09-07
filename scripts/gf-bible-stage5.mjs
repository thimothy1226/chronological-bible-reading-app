import fs from 'node:fs';

const path = 'App.js';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(from, to);
};

replaceOnce(
  "          <View style={styles.content}>\n            <View style={styles.planSelectorRow}>",
  "          <ScrollView style={styles.todayScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n            <View style={styles.planSelectorRow}>",
  'today scroll opening',
);
replaceOnce(
  "            </View>\n          </View>\n        ) : screen === 'records' ? (\n          <View style={styles.recordsWrap}>",
  "            </View>\n          </ScrollView>\n        ) : screen === 'records' ? (\n          <View style={styles.recordsWrap}>",
  'today scroll closing',
);

replaceOnce(
  "            {completionModal?.finalDay ? <Text style={styles.finalCongrats}>365일 연대기별 성경통독 일정을 모두 완료했습니다!</Text> : null}",
  "            {completionModal?.finalDay ? <Text style={styles.finalCongrats}>{activeReadingPlan.name} {activeSchedule.length}일 일정을 모두 완료했습니다!</Text> : null}",
  'dynamic completion congratulations',
);

replaceOnce(
  "              <View><Text style={styles.modalTitle}>일정 선택</Text><Text style={styles.modalSubtitle}>Day 001부터 Day 365까지 선택할 수 있습니다. 오늘 일정은 그대로 유지됩니다.</Text></View>",
  "              <View style={{ flex: 1 }}><Text style={styles.modalTitle}>일정 선택</Text><Text style={styles.modalSubtitle}>Day 001부터 Day {String(activeSchedule.length).padStart(activeSchedule.length >= 100 ? 3 : 2, '0')}까지 선택할 수 있습니다. 오늘 일정은 그대로 유지됩니다.</Text></View>",
  'dynamic day picker total',
);

replaceOnce(
  "  safeArea: { flex: 1, backgroundColor: '#F7F6F1' }, app: { flex: 1 }, loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },",
  "  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, backgroundColor: '#F7F6F1' }, app: { flex: 1 }, loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },",
  'android safe area',
);

replaceOnce(
  "  tabs: { marginHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 14, backgroundColor: '#EAE8E1' },\n  tab: { width: '33.333%', paddingHorizontal: 5, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },",
  "  tabs: { marginHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 14, backgroundColor: '#EAE8E1' },\n  tab: { width: '33.333%', minHeight: 42, paddingHorizontal: 3, paddingVertical: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },",
  'responsive tabs',
);
replaceOnce(
  "  tabText: { color: '#7A7F87', fontWeight: '800', fontSize: 13, textAlign: 'center' },",
  "  tabText: { color: '#7A7F87', fontWeight: '800', fontSize: 12, lineHeight: 17, textAlign: 'center', flexShrink: 1 },",
  'responsive tab text',
);
replaceOnce(
  "  content: { flex: 1, paddingHorizontal: 22, paddingTop: 22 }, planSelectorRow:",
  "  todayScroll: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 22, paddingBottom: Platform.OS === 'android' ? 96 : 72 }, planSelectorRow:",
  'today content scroll style',
);

fs.writeFileSync(path, source);
console.log('GF Bible stage5 responsive layout patch applied.');
