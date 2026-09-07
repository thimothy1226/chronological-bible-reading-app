import fs from 'node:fs';

const path = 'App.js';
let source = fs.readFileSync(path, 'utf8');
const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(from, to);
};

replaceOnce(
  "import {\n  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot,\n  query, serverTimestamp, setDoc, updateDoc, where, writeBatch,\n} from 'firebase/firestore';",
  "import {\n  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot,\n  query, serverTimestamp, setDoc, updateDoc, where, writeBatch,\n} from 'firebase/firestore';\nimport { getFunctions, httpsCallable } from 'firebase/functions';",
  'functions import',
);

replaceOnce(
  "const firestore = getFirestore(firebaseApp);",
  "const firestore = getFirestore(firebaseApp);\nconst firebaseFunctions = getFunctions(firebaseApp, 'asia-northeast3');",
  'functions instance',
);

replaceOnce(
  "const VERSE_HIGHLIGHTS_KEY = '@gf_bible/verse_highlights';",
  "const VERSE_HIGHLIGHTS_KEY = '@gf_bible/verse_highlights';\nconst HIGHLIGHT_COLORS = [\n  { key: 'yellow', label: '노랑', color: '#FFF3A8' },\n  { key: 'pink', label: '분홍', color: '#FFD6E5' },\n  { key: 'green', label: '연두', color: '#DDF3C4' },\n  { key: 'blue', label: '하늘', color: '#D9ECFF' },\n];",
  'highlight palette',
);

replaceOnce(
  "  const [memberSnapshotReady, setMemberSnapshotReady] = useState(false);\n\n  const readerRef = useRef(null);",
  "  const [memberSnapshotReady, setMemberSnapshotReady] = useState(false);\n  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);\n\n  const readerRef = useRef(null);",
  'highlight picker state',
);

replaceOnce(
  "  const handledNotificationRef = useRef(null);",
  "  const handledNotificationRef = useRef(null);\n  const savedVerseReturnRef = useRef(null);",
  'saved verse transient ref',
);

replaceOnce(
  "  const activeReadingPlan = READING_PLANS[readingPlanId] || READING_PLANS[DEFAULT_READING_PLAN_ID];\n  const activeSchedule = activeReadingPlan.schedule;\n\n  useEffect(() => {",
  "  const activeReadingPlan = READING_PLANS[readingPlanId] || READING_PLANS[DEFAULT_READING_PLAN_ID];\n  const activeSchedule = activeReadingPlan.schedule;\n\n  const resolveAdminRecordForUser = async (user) => {\n    if (!user) return null;\n    if (user.uid === ADMIN_UID) return { role: 'superAdmin', groupIds: [] };\n    let snapshot = await getDoc(doc(firestore, 'admins', user.uid));\n    if (snapshot.exists()) return snapshot.data()?.active === false ? null : snapshot.data();\n    try {\n      const repairLegacyAdminAccess = httpsCallable(firebaseFunctions, 'repairLegacyAdminAccess');\n      await repairLegacyAdminAccess({});\n      snapshot = await getDoc(doc(firestore, 'admins', user.uid));\n      return snapshot.exists() && snapshot.data()?.active !== false ? snapshot.data() : null;\n    } catch (error) {\n      console.warn('Legacy admin repair failed:', error);\n      return null;\n    }\n  };\n\n  useEffect(() => {",
  'admin record resolver',
);

replaceOnce(
  "    try {\n      const adminRecord = await getDoc(doc(firestore, 'admins', user.uid));\n      const allowed = adminRecord.exists() && adminRecord.data()?.active !== false;\n      setAdminAuthorized(allowed);\n      setAdminRecord(allowed ? adminRecord.data() : null);\n      if (!allowed) await signOut(firebaseAuth);\n    } catch (error) {",
  "    try {\n      const resolvedRecord = await resolveAdminRecordForUser(user);\n      const allowed = !!resolvedRecord;\n      setAdminAuthorized(allowed);\n      setAdminRecord(resolvedRecord);\n      if (!allowed) await signOut(firebaseAuth);\n    } catch (error) {",
  'auth state legacy repair',
);

replaceOnce(
  "    return onSnapshot(doc(firestore, 'admins', adminUser.uid), (snapshot) => {\n      const allowed = snapshot.exists() && snapshot.data()?.active !== false;\n      setAdminAuthorized(allowed);\n      setAdminRecord(allowed ? snapshot.data() : null);\n      if (!allowed) signOut(firebaseAuth).catch(() => {});\n    }, (error) => console.warn('Admin permission listener failed:', error));",
  "    return onSnapshot(doc(firestore, 'admins', adminUser.uid), async (snapshot) => {\n      if (snapshot.exists()) {\n        const allowed = snapshot.data()?.active !== false;\n        setAdminAuthorized(allowed);\n        setAdminRecord(allowed ? snapshot.data() : null);\n        if (!allowed) signOut(firebaseAuth).catch(() => {});\n        return;\n      }\n      const repaired = await resolveAdminRecordForUser(adminUser);\n      setAdminAuthorized(!!repaired);\n      setAdminRecord(repaired);\n      if (!repaired) signOut(firebaseAuth).catch(() => {});\n    }, (error) => console.warn('Admin permission listener failed:', error));",
  'admin listener legacy repair',
);

replaceOnce(
  "      const loginAdminDoc = credential.user.uid === ADMIN_UID ? null : await getDoc(doc(firestore, 'admins', credential.user.uid));\n      const record = loginAdminDoc?.exists() ? loginAdminDoc.data() : null;\n      const allowed = credential.user.uid === ADMIN_UID || (record && record.active !== false);",
  "      const record = credential.user.uid === ADMIN_UID ? { role: 'superAdmin', groupIds: [] } : await resolveAdminRecordForUser(credential.user);\n      const allowed = credential.user.uid === ADMIN_UID || !!record;",
  'login legacy repair',
);

replaceOnce(
  "  const closeReader = async (destination = readerReturnScreen) => {\n    setSelectedVerses([]);\n    await saveCurrentPosition();\n    setScreen(destination);\n  };",
  "  const closeReader = async (destination = readerReturnScreen) => {\n    setSelectedVerses([]);\n    const transient = savedVerseReturnRef.current;\n    if (transient) {\n      savedVerseReturnRef.current = null;\n      setTranslationId(transient.translationId);\n      setTestament(transient.testament);\n      setSelectedBookKey(transient.book);\n      setSelectedChapter(transient.chapter);\n      setSelectedVerse(transient.verse);\n      setReaderContext(null);\n      restoredKey.current = null;\n      pendingTargetY.current = null;\n      setScreen(destination);\n      return;\n    }\n    await saveCurrentPosition();\n    setScreen(destination);\n  };",
  'transient reader close',
);

replaceOnce(
  "  const toggleHighlightForSelection = async () => {\n    if (!selectedVerses.length) return;\n    const allHighlighted = selectedVerses.every((v) => verseHighlights[v.key]);\n    const next = { ...verseHighlights };\n    selectedVerses.forEach((v) => {\n      if (allHighlighted) delete next[v.key];\n      else next[v.key] = { label: `${v.bookKo} ${v.chapter}:${v.verse}`, text: v.text, savedAt: formatKoreanDateTime() };\n    });\n    setVerseHighlights(next);\n    await AsyncStorage.setItem(VERSE_HIGHLIGHTS_KEY, JSON.stringify(next));\n  };",
  "  const applyHighlightColor = async (colorKey) => {\n    if (!selectedVerses.length) return;\n    const color = HIGHLIGHT_COLORS.find((item) => item.key === colorKey)?.color || HIGHLIGHT_COLORS[0].color;\n    const next = { ...verseHighlights };\n    selectedVerses.forEach((v) => {\n      next[v.key] = { label: `${v.bookKo} ${v.chapter}:${v.verse}`, text: v.text, savedAt: formatKoreanDateTime(), colorKey, color };\n    });\n    setVerseHighlights(next);\n    await AsyncStorage.setItem(VERSE_HIGHLIGHTS_KEY, JSON.stringify(next));\n    setHighlightPickerOpen(false);\n    setSelectedVerses([]);\n  };\n\n  const removeHighlightForSelection = async () => {\n    if (!selectedVerses.length) return;\n    const next = { ...verseHighlights };\n    selectedVerses.forEach((v) => delete next[v.key]);\n    setVerseHighlights(next);\n    await AsyncStorage.setItem(VERSE_HIGHLIGHTS_KEY, JSON.stringify(next));\n    setHighlightPickerOpen(false);\n    setSelectedVerses([]);\n  };\n\n  const openSavedVerse = (key) => {\n    const [savedTranslationId, bookKo, chapterText, verseText] = String(key).split(':');\n    const chapter = Number(chapterText);\n    const verse = Number(verseText);\n    const targetTranslation = allBibleData[savedTranslationId] ? savedTranslationId : translationId;\n    const targetBooks = BIBLE_BOOKS.map((meta) => ({ ...meta, data: getBook(allBibleData[targetTranslation], meta.book, meta.ko) })).filter((item) => item.data);\n    const target = targetBooks.find((item) => item.ko === bookKo || item.book === bookKo);\n    if (!target || !chapter || !verse) {\n      Alert.alert('본문 열기 실패', '저장된 구절의 성경 위치를 찾지 못했습니다.');\n      return;\n    }\n    savedVerseReturnRef.current = {\n      translationId, testament, book: selectedBookKey, chapter: selectedChapter, verse: selectedVerse,\n    };\n    setTranslationId(targetTranslation);\n    setReaderReturnScreen('more');\n    setReaderContext({ type: 'chapter', book: target.book, bookKo: target.ko, chapter, verse });\n    restoredKey.current = null;\n    pendingTargetY.current = 0;\n    lastScrollY.current = 0;\n    setSelectedVerses([]);\n    setScreen('reader');\n  };",
  'multi-color highlights and saved verse navigation',
);

replaceOnce(
  "            <TouchableOpacity onPress={toggleHighlightForSelection} style={styles.selectionAction}><Text style={styles.selectionActionText}>형광펜</Text></TouchableOpacity>",
  "            <TouchableOpacity onPress={() => setHighlightPickerOpen(true)} style={styles.selectionAction}><Text style={styles.selectionActionText}>형광펜</Text></TouchableOpacity>",
  'highlight button picker',
);

replaceOnce(
  "                    style={[isTargetVerse && styles.targetVerseWrap, verseHighlights[verseKey(v)] && styles.highlightedVerseWrap, selectedVerses.some((x) => x.key === verseKey(v)) && styles.selectedVerseWrap]}",
  "                    style={[isTargetVerse && styles.targetVerseWrap, verseHighlights[verseKey(v)] && [styles.highlightedVerseWrap, { backgroundColor: verseHighlights[verseKey(v)]?.color || '#FFF3A8' }], selectedVerses.some((x) => x.key === verseKey(v)) && styles.selectedVerseWrap]}",
  'highlight visual color',
);

replaceOnce(
  "        <TranslationPicker />\n\n        <Modal visible={!!noteModal}",
  "        <TranslationPicker />\n\n        <Modal visible={highlightPickerOpen} transparent animationType=\"fade\" onRequestClose={() => setHighlightPickerOpen(false)}>\n          <View style={styles.highlightPickerBackdrop}>\n            <View style={styles.highlightPickerCard}>\n              <Text style={styles.highlightPickerTitle}>형광펜 색상</Text>\n              <Text style={styles.highlightPickerSubtitle}>선택한 {selectedVerses.length}절에 표시할 색을 골라 주세요.</Text>\n              <View style={styles.highlightColorRow}>\n                {HIGHLIGHT_COLORS.map((item) => <TouchableOpacity key={item.key} onPress={() => applyHighlightColor(item.key)} style={[styles.highlightColorButton, { backgroundColor: item.color }]}><Text style={styles.highlightColorText}>{item.label}</Text></TouchableOpacity>)}\n              </View>\n              <View style={styles.highlightPickerActions}>\n                <TouchableOpacity onPress={removeHighlightForSelection} style={styles.highlightRemoveButton}><Text style={styles.highlightRemoveText}>형광펜 해제</Text></TouchableOpacity>\n                <TouchableOpacity onPress={() => setHighlightPickerOpen(false)} style={styles.highlightCancelButton}><Text style={styles.highlightCancelText}>취소</Text></TouchableOpacity>\n              </View>\n            </View>\n          </View>\n        </Modal>\n\n        <Modal visible={!!noteModal}",
  'highlight picker modal',
);

replaceOnce(
  "      else if (screen === 'reader') closeReader(readerContext?.type === 'chapter' ? 'bibleIndex' : 'today');",
  "      else if (screen === 'reader') closeReader(savedVerseReturnRef.current ? 'more' : (readerContext?.type === 'chapter' ? 'bibleIndex' : 'today'));",
  'android back transient reader',
);

replaceOnce(
  "                  return <View key={key} style={styles.savedVerseCard}><Text style={styles.savedVerseLabel}>{label}</Text><Text style={styles.savedVerseText}>{body}</Text>{value?.savedAt ? <Text style={styles.savedVerseDate}>{value.savedAt}</Text> : null}</View>;",
  "                  return <TouchableOpacity key={key} onPress={() => openSavedVerse(key)} style={[styles.savedVerseCard, moreMode === 'highlights' && { borderLeftWidth: 7, borderLeftColor: value?.color || '#FFF3A8' }]}><Text style={styles.savedVerseLabel}>{label}</Text><Text style={styles.savedVerseText}>{body}</Text>{value?.savedAt ? <Text style={styles.savedVerseDate}>{value.savedAt}</Text> : null}<Text style={styles.savedVerseOpenHint}>본문으로 이동 ›</Text></TouchableOpacity>;",
  'more saved verse navigation',
);

replaceOnce(
  "  readerContent: { padding: 20, paddingBottom: 40 },",
  "  readerContent: { padding: 20, paddingBottom: Platform.OS === 'android' ? 110 : 72 },",
  'reader bottom content padding',
);
replaceOnce(
  "  chapterNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 28 : 16, backgroundColor: '#F7F6F1', borderTopWidth: 1, borderTopColor: '#E3DED2', elevation: 8 },",
  "  chapterNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? Math.max(18, Math.round((StatusBar.currentHeight || 24) * 0.9)) : 16, backgroundColor: '#F7F6F1', borderTopWidth: 1, borderTopColor: '#E3DED2', elevation: 8 },",
  'reader navigation bottom safe padding',
);

replaceOnce(
  "  homologiaReaderSafe: { flex: 1, backgroundColor: '#F4F1E9' },",
  "  homologiaReaderSafe: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0, backgroundColor: '#F4F1E9' },",
  'homologia android safe top',
);
replaceOnce(
  "  homologiaReaderHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFFEFB', borderBottomWidth: 1, borderBottomColor: '#DED8C8', gap: 8 },",
  "  homologiaReaderHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFFEFB', borderBottomWidth: 1, borderBottomColor: '#DED8C8', gap: 8 },",
  'homologia header height',
);

replaceOnce(
  "savedVerseDate: { marginTop: 8, color: '#93979E', fontSize: 10, fontWeight: '700' },",
  "savedVerseDate: { marginTop: 8, color: '#93979E', fontSize: 10, fontWeight: '700' }, savedVerseOpenHint: { marginTop: 9, color: '#173C70', fontSize: 11, fontWeight: '900', textAlign: 'right' },",
  'saved verse hint style',
);

replaceOnce(
  "selectedVerseWrap: { backgroundColor: '#DCEBFA', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 }, noteMark: { fontSize: 13 },",
  "highlightedVerseWrap: { borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 }, selectedVerseWrap: { backgroundColor: '#DCEBFA', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 }, noteMark: { fontSize: 13 },\n  highlightPickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 }, highlightPickerCard: { width: '100%', maxWidth: 430, padding: 20, borderRadius: 20, backgroundColor: '#FFFEFB' }, highlightPickerTitle: { color: '#17223B', fontSize: 20, fontWeight: '900' }, highlightPickerSubtitle: { marginTop: 5, color: '#747C86', fontSize: 12, lineHeight: 18 }, highlightColorRow: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, highlightColorButton: { width: '47%', minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#D8D2C7', alignItems: 'center', justifyContent: 'center' }, highlightColorText: { color: '#3E4350', fontWeight: '900' }, highlightPickerActions: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, highlightRemoveButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#F3E8E5', alignItems: 'center', justifyContent: 'center' }, highlightRemoveText: { color: '#A04B3C', fontWeight: '900' }, highlightCancelButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#E9E5DC', alignItems: 'center', justifyContent: 'center' }, highlightCancelText: { color: '#5E6570', fontWeight: '900' },",
  'highlight styles',
);

fs.writeFileSync(path, source);
console.log('GF Bible stage6 fixes applied.');
