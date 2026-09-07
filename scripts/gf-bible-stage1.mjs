import fs from 'node:fs';

const path = 'App.js';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(from, to);
};

replaceOnce(
  "import schedule from './assets/schedule.json';",
  "import { DEFAULT_READING_PLAN_ID, READING_PLAN_DEFINITIONS, READING_PLANS } from './assets/readingPlans';",
  'reading plan import',
);

replaceOnce(
  "const CURRENT_DAY_KEY = '@chronological_bible/current_day';\nconst COMPLETIONS_KEY = '@chronological_bible/completions';",
  "const CURRENT_DAY_KEY = '@chronological_bible/current_day';\nconst COMPLETIONS_KEY = '@chronological_bible/completions';\nconst READING_PLAN_KEY = '@gf_bible/reading_plan';\nconst READING_PLAN_PROGRESS_PREFIX = '@gf_bible/plan_progress/';\nconst readingPlanProgressKey = (planId) => `${READING_PLAN_PROGRESS_PREFIX}${planId}`;",
  'reading plan storage keys',
);

replaceOnce(
  "  const [currentDay, setCurrentDay] = useState(1);\n  const [displayDay, setDisplayDay] = useState(1);\n  const [completions, setCompletions] = useState({});",
  "  const [readingPlanId, setReadingPlanId] = useState(DEFAULT_READING_PLAN_ID);\n  const [readingPlanPickerOpen, setReadingPlanPickerOpen] = useState(false);\n  const [currentDay, setCurrentDay] = useState(1);\n  const [displayDay, setDisplayDay] = useState(1);\n  const [completions, setCompletions] = useState({});",
  'reading plan state',
);

replaceOnce(
  "  const postsForCurrentGroup = communityPosts.filter((post) => (post.groupId || 'gfc') === noticeGroupId);",
  "  const postsForCurrentGroup = communityPosts.filter((post) => (post.groupId || 'gfc') === noticeGroupId);\n  const activeReadingPlan = READING_PLANS[readingPlanId] || READING_PLANS[DEFAULT_READING_PLAN_ID];\n  const activeSchedule = activeReadingPlan.schedule;",
  'active reading plan',
);

source = source.replace(/\bschedule\b/g, 'activeSchedule');
source = source.replace("import { DEFAULT_READING_PLAN_ID, READING_PLAN_DEFINITIONS, READING_PLANS } from './assets/readingPlans';", "import { DEFAULT_READING_PLAN_ID, READING_PLAN_DEFINITIONS, READING_PLANS } from './assets/readingPlans';");
source = source.replace('const activeReadingPlan = READING_PLANS[readingPlanId] || READING_PLANS[DEFAULT_READING_PLAN_ID];\n  const activeSchedule = activeReadingPlan.activeSchedule;', 'const activeReadingPlan = READING_PLANS[readingPlanId] || READING_PLANS[DEFAULT_READING_PLAN_ID];\n  const activeSchedule = activeReadingPlan.schedule;');

replaceOnce(
  "          CURRENT_DAY_KEY, COMPLETIONS_KEY, TRANSLATION_KEY, FONT_SIZE_KEY, READER_POSITIONS_KEY, VERSE_NOTES_KEY, BIBLE_SELECTION_KEY, HOMOLOGIA_FONT_SCALE_KEY, HOMOLOGIA_PDF_SCALE_KEY, HOMOLOGIA_PDF_POSITIONS_KEY, CUSTOM_TRANSLATIONS_KEY, COMMUNITY_GROUPS_KEY, CURRENT_GROUP_KEY,",
  "          CURRENT_DAY_KEY, COMPLETIONS_KEY, READING_PLAN_KEY, TRANSLATION_KEY, FONT_SIZE_KEY, READER_POSITIONS_KEY, VERSE_NOTES_KEY, BIBLE_SELECTION_KEY, HOMOLOGIA_FONT_SCALE_KEY, HOMOLOGIA_PDF_SCALE_KEY, HOMOLOGIA_PDF_POSITIONS_KEY, CUSTOM_TRANSLATIONS_KEY, COMMUNITY_GROUPS_KEY, CURRENT_GROUP_KEY,",
  'load reading plan key',
);

replaceOnce(
  "        const d = Number(saved[CURRENT_DAY_KEY] || 1);\n        const safeDay = Number.isFinite(d) && d >= 1 && d <= 365 ? d : 1;",
  "        const savedPlanId = READING_PLANS[saved[READING_PLAN_KEY]] ? saved[READING_PLAN_KEY] : DEFAULT_READING_PLAN_ID;\n        const savedPlan = READING_PLANS[savedPlanId] || READING_PLANS[DEFAULT_READING_PLAN_ID];\n        const persistedPlanProgress = safeParseJson(await AsyncStorage.getItem(readingPlanProgressKey(savedPlanId)), null);\n        const legacyDay = Number(saved[CURRENT_DAY_KEY] || 1);\n        const legacyCompletions = migrateCompletions(safeParseJson(saved[COMPLETIONS_KEY], {}));\n        const d = Number(persistedPlanProgress?.currentDay || (savedPlanId === DEFAULT_READING_PLAN_ID ? legacyDay : 1));\n        const safeDay = Number.isFinite(d) && d >= 1 && d <= savedPlan.schedule.length ? d : 1;",
  'load plan progress',
);

replaceOnce(
  "        setCurrentDay(safeDay);\n        setDisplayDay(safeDay);\n        const migrated = migrateCompletions(safeParseJson(saved[COMPLETIONS_KEY], {}));\n        setCompletions(migrated);",
  "        setReadingPlanId(savedPlanId);\n        setCurrentDay(safeDay);\n        setDisplayDay(safeDay);\n        const migrated = persistedPlanProgress?.completions\n          ? migrateCompletions(persistedPlanProgress.completions)\n          : (savedPlanId === DEFAULT_READING_PLAN_ID ? legacyCompletions : {});\n        setCompletions(migrated);\n        if (!persistedPlanProgress && savedPlanId === DEFAULT_READING_PLAN_ID) {\n          await AsyncStorage.setItem(readingPlanProgressKey(savedPlanId), JSON.stringify({ currentDay: safeDay, completions: migrated }));\n        }",
  'set plan progress',
);

replaceOnce(
  "  const displayed = activeSchedule[displayDay - 1];",
  "  const displayed = activeSchedule[displayDay - 1];\n\n  const changeReadingPlan = async (nextPlanId) => {\n    if (!READING_PLANS[nextPlanId] || nextPlanId === readingPlanId) {\n      setReadingPlanPickerOpen(false);\n      return;\n    }\n    try {\n      await AsyncStorage.setItem(readingPlanProgressKey(readingPlanId), JSON.stringify({ currentDay, completions }));\n      if (readingPlanId === DEFAULT_READING_PLAN_ID) {\n        await AsyncStorage.multiSet([[CURRENT_DAY_KEY, String(currentDay)], [COMPLETIONS_KEY, JSON.stringify(completions)]]);\n      }\n      const nextPlan = READING_PLANS[nextPlanId];\n      const raw = await AsyncStorage.getItem(readingPlanProgressKey(nextPlanId));\n      const savedProgress = safeParseJson(raw, {});\n      const nextDayRaw = Number(savedProgress.currentDay || 1);\n      const nextDay = Number.isFinite(nextDayRaw) && nextDayRaw >= 1 && nextDayRaw <= nextPlan.schedule.length ? nextDayRaw : 1;\n      const nextCompletions = migrateCompletions(savedProgress.completions || {});\n      setReadingPlanId(nextPlanId);\n      setCurrentDay(nextDay);\n      setDisplayDay(nextDay);\n      setCompletions(nextCompletions);\n      setReadingPlanPickerOpen(false);\n      await AsyncStorage.setItem(READING_PLAN_KEY, nextPlanId);\n    } catch (error) {\n      console.warn('Reading plan change failed:', error);\n      Alert.alert('통독 방식 변경 실패', '통독 방식을 변경하지 못했습니다. 다시 시도해 주세요.');\n    }\n  };",
  'change reading plan handler',
);

replaceOnce(
  "    await AsyncStorage.multiSet([\n      [COMPLETIONS_KEY, JSON.stringify(next)],\n      [CURRENT_DAY_KEY, String(nextDay)],\n    ]);",
  "    const progressWrites = [\n      [readingPlanProgressKey(readingPlanId), JSON.stringify({ currentDay: nextDay, completions: next })],\n      [READING_PLAN_KEY, readingPlanId],\n    ];\n    if (readingPlanId === DEFAULT_READING_PLAN_ID) {\n      progressWrites.push([COMPLETIONS_KEY, JSON.stringify(next)], [CURRENT_DAY_KEY, String(nextDay)]);\n    }\n    await AsyncStorage.multiSet(progressWrites);",
  'complete day plan persistence',
);

replaceOnce(
  "            await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(next));\n            setCompletions(next);",
  "            await AsyncStorage.setItem(readingPlanProgressKey(readingPlanId), JSON.stringify({ currentDay, completions: next }));\n            if (readingPlanId === DEFAULT_READING_PLAN_ID) await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(next));\n            setCompletions(next);",
  'cancel completion plan persistence',
);

replaceOnce(
  "        <View style={styles.header}>\n          <View><Text style={styles.eyebrow}>365-DAY BIBLE READING</Text><Text style={styles.title}>연대기별 성경통독 일정표</Text></View>",
  "        <View style={styles.header}>\n          <View><Text style={styles.eyebrow}>GF BIBLE</Text><Text style={styles.title}>GF 바이블</Text></View>",
  'GF Bible header',
);

replaceOnce(
  "          <TouchableOpacity onPress={() => setScreen('bibleIndex')} style={[styles.tab, screen === 'bibleIndex' && styles.tabActive]}><Text style={[styles.tabText, screen === 'bibleIndex' && styles.tabTextActive]}>성경보기</Text></TouchableOpacity>",
  "          <TouchableOpacity onPress={openChapterReader} style={[styles.tab, (screen === 'bibleIndex' || (screen === 'reader' && readerContext?.type === 'chapter')) && styles.tabActive]}><Text style={[styles.tabText, (screen === 'bibleIndex' || (screen === 'reader' && readerContext?.type === 'chapter')) && styles.tabTextActive]}>성경보기</Text></TouchableOpacity>",
  'Bible tab last position',
);

replaceOnce(
  "            <Text style={styles.chapterNavCurrent}>{readerContext.bookKo} {readerContext.chapter}장</Text>",
  "            <TouchableOpacity onPress={() => closeReader('bibleIndex')} style={styles.chapterSearchButton}><Text style={styles.chapterSearchButtonText}>성경찾기</Text></TouchableOpacity>",
  'Bible search bottom button',
);

replaceOnce(
  "        ) : screen === 'today' && displayed ? (\n          <View style={styles.content}>\n            <View style={styles.progressBlock}>",
  "        ) : screen === 'today' && displayed ? (\n          <View style={styles.content}>\n            <View style={styles.planSelectorRow}>\n              <TouchableOpacity onPress={() => setReadingPlanPickerOpen(true)} style={styles.planSelectorButton}>\n                <Text style={styles.planSelectorLabel}>통독 방식</Text>\n                <Text numberOfLines={1} style={styles.planSelectorValue}>{activeReadingPlan.name} ▼</Text>\n              </TouchableOpacity>\n              <TouchableOpacity onPress={() => setScreen('records')} style={styles.todayRecordsButton}><Text style={styles.todayRecordsButtonText}>완료 기록</Text></TouchableOpacity>\n            </View>\n            <View style={styles.progressBlock}>",
  'today plan selector',
);

replaceOnce(
  "              <View style={styles.progressTextRow}><Text style={styles.progressLabel}>통독 진행률</Text><Text style={styles.progressValue}>{completedCount} / 365</Text></View>",
  "              <View style={styles.progressTextRow}><Text style={styles.progressLabel}>통독 진행률</Text><Text style={styles.progressValue}>{completedCount} / {activeSchedule.length}</Text></View>",
  'dynamic progress total',
);

replaceOnce(
  "      <TranslationPicker />\n\n      <Modal visible={nicknameEditorOpen}",
  "      <TranslationPicker />\n\n      <Modal visible={readingPlanPickerOpen} transparent animationType=\"fade\" onRequestClose={() => setReadingPlanPickerOpen(false)}>\n        <TouchableOpacity activeOpacity={1} onPress={() => setReadingPlanPickerOpen(false)} style={styles.pickerBackdrop}>\n          <View style={styles.translationPickerCard} onStartShouldSetResponder={() => true}>\n            <View style={styles.modalHeader}>\n              <View><Text style={styles.modalTitle}>통독 방식 선택</Text><Text style={styles.modalSubtitle}>각 통독 방식의 진행률과 완료 기록은 따로 저장됩니다.</Text></View>\n              <TouchableOpacity onPress={() => setReadingPlanPickerOpen(false)} style={styles.modalClose}><Text style={styles.modalCloseText}>닫기</Text></TouchableOpacity>\n            </View>\n            <View style={styles.translationPickerList}>\n              {READING_PLAN_DEFINITIONS.map((plan) => {\n                const active = plan.id === readingPlanId;\n                return <TouchableOpacity key={plan.id} onPress={() => changeReadingPlan(plan.id)} style={[styles.translationPickerRow, active && styles.translationPickerRowActive]}><Text style={[styles.translationPickerName, active && styles.translationPickerNameActive]}>{plan.name}</Text><Text style={[styles.translationPickerCheck, active && styles.translationPickerCheckActive]}>{active ? '✓' : ''}</Text></TouchableOpacity>;\n              })}\n            </View>\n          </View>\n        </TouchableOpacity>\n      </Modal>\n\n      <Modal visible={nicknameEditorOpen}",
  'reading plan picker modal',
);

replaceOnce(
  "        message: `${group.name}에 초대합니다.\\n연대기별 성경통독 일정표 앱에서 아래 초대 코드를 입력해 주세요.\\n\\n초대 코드: ${code}`,
",
  "        message: `${group.name}에 초대합니다.\\nGF 바이블 앱에서 아래 초대 코드를 입력해 주세요.\\n\\n초대 코드: ${code}`,
",
  'invite GF Bible name',
);

replaceOnce(
  "      ['1. 목적', '이 약관은 연대기별 성경통독 일정표 앱이 제공하는 성경 읽기, 기록, 그룹 공지 및 관련 기능의 이용 기준을 정합니다.'],",
  "      ['1. 목적', '이 약관은 GF 바이블 앱이 제공하는 성경 읽기, 기록, 그룹 공지 및 관련 기능의 이용 기준을 정합니다.'],",
  'terms app name',
);

source = source.replaceAll('연대기별 성경통독 일정표는 이용자의 정보를 소중하게 보호합니다.', 'GF 바이블은 이용자의 정보를 소중하게 보호합니다.');
source = source.replaceAll('연대기별 성경통독 일정표를 안전하고 편리하게 이용하기 위한 기본 약속입니다.', 'GF 바이블을 안전하고 편리하게 이용하기 위한 기본 약속입니다.');

replaceOnce(
  "  content: { flex: 1, paddingHorizontal: 22, paddingTop: 22 }, progressBlock: { marginBottom: 18 },",
  "  content: { flex: 1, paddingHorizontal: 22, paddingTop: 22 }, planSelectorRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 14 }, planSelectorButton: { flex: 1, minHeight: 58, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DED9CE', justifyContent: 'center' }, planSelectorLabel: { color: '#8A8170', fontSize: 10, fontWeight: '800', marginBottom: 3 }, planSelectorValue: { color: '#17223B', fontSize: 14, fontWeight: '900' }, todayRecordsButton: { minWidth: 92, paddingHorizontal: 13, borderRadius: 14, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center' }, todayRecordsButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, progressBlock: { marginBottom: 18 },",
  'plan selector styles',
);

replaceOnce(
  "  chapterNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 48 : 16, backgroundColor: '#F7F6F1', borderTopWidth: 1, borderTopColor: '#E3DED2', elevation: 8 }, chapterNavButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, chapterNavButtonText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, chapterNavCurrent: { minWidth: 88, textAlign: 'center', color: '#17223B', fontSize: 13, fontWeight: '900' },",
  "  chapterNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 28 : 16, backgroundColor: '#F7F6F1', borderTopWidth: 1, borderTopColor: '#E3DED2', elevation: 8 }, chapterNavButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, chapterNavButtonText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, chapterSearchButton: { minWidth: 94, minHeight: 48, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#E9E5DC', alignItems: 'center', justifyContent: 'center' }, chapterSearchButtonText: { color: '#17223B', fontSize: 13, fontWeight: '900' },",
  'chapter search styles',
);

fs.writeFileSync(path, source);
console.log('GF Bible stage1 patch applied successfully.');
