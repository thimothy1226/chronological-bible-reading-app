import fs from 'node:fs';

const path = 'App.js';
let source = fs.readFileSync(path, 'utf8');
const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(from, to);
};

replaceOnce(
  "const VERSE_NOTES_KEY = '@chronological_bible/verse_notes';",
  "const VERSE_NOTES_KEY = '@chronological_bible/verse_notes';\nconst VERSE_BOOKMARKS_KEY = '@gf_bible/verse_bookmarks';\nconst VERSE_HIGHLIGHTS_KEY = '@gf_bible/verse_highlights';",
  'bookmark storage keys',
);

replaceOnce(
  "  const [verseNotes, setVerseNotes] = useState({});\n  const [noteModal, setNoteModal] = useState(null);",
  "  const [verseNotes, setVerseNotes] = useState({});\n  const [verseBookmarks, setVerseBookmarks] = useState({});\n  const [verseHighlights, setVerseHighlights] = useState({});\n  const [moreMode, setMoreMode] = useState(null);\n  const [noteModal, setNoteModal] = useState(null);",
  'bookmark state',
);

replaceOnce(
  "CURRENT_DAY_KEY, COMPLETIONS_KEY, READING_PLAN_KEY, TRANSLATION_KEY, FONT_SIZE_KEY, READER_POSITIONS_KEY, VERSE_NOTES_KEY, BIBLE_SELECTION_KEY,",
  "CURRENT_DAY_KEY, COMPLETIONS_KEY, READING_PLAN_KEY, TRANSLATION_KEY, FONT_SIZE_KEY, READER_POSITIONS_KEY, VERSE_NOTES_KEY, VERSE_BOOKMARKS_KEY, VERSE_HIGHLIGHTS_KEY, BIBLE_SELECTION_KEY,",
  'load bookmark keys',
);

replaceOnce(
  "        setVerseNotes(safeParseJson(saved[VERSE_NOTES_KEY], {}));",
  "        setVerseNotes(safeParseJson(saved[VERSE_NOTES_KEY], {}));\n        setVerseBookmarks(safeParseJson(saved[VERSE_BOOKMARKS_KEY], {}));\n        setVerseHighlights(safeParseJson(saved[VERSE_HIGHLIGHTS_KEY], {}));",
  'load bookmarks',
);

replaceOnce(
  "  const copySelectedVerses = async () => {",
  "  const toggleBookmarkForSelection = async () => {\n    if (!selectedVerses.length) return;\n    const allBookmarked = selectedVerses.every((v) => verseBookmarks[v.key]);\n    const next = { ...verseBookmarks };\n    selectedVerses.forEach((v) => {\n      if (allBookmarked) delete next[v.key];\n      else next[v.key] = { label: `${v.bookKo} ${v.chapter}:${v.verse}`, text: v.text, savedAt: formatKoreanDateTime() };\n    });\n    setVerseBookmarks(next);\n    await AsyncStorage.setItem(VERSE_BOOKMARKS_KEY, JSON.stringify(next));\n  };\n\n  const toggleHighlightForSelection = async () => {\n    if (!selectedVerses.length) return;\n    const allHighlighted = selectedVerses.every((v) => verseHighlights[v.key]);\n    const next = { ...verseHighlights };\n    selectedVerses.forEach((v) => {\n      if (allHighlighted) delete next[v.key];\n      else next[v.key] = { label: `${v.bookKo} ${v.chapter}:${v.verse}`, text: v.text, savedAt: formatKoreanDateTime() };\n    });\n    setVerseHighlights(next);\n    await AsyncStorage.setItem(VERSE_HIGHLIGHTS_KEY, JSON.stringify(next));\n  };\n\n  const copySelectedVerses = async () => {",
  'bookmark handlers',
);

replaceOnce(
  "            <TouchableOpacity onPress={copySelectedVerses} style={styles.selectionAction}><Text style={styles.selectionActionText}>복사</Text></TouchableOpacity>\n            <TouchableOpacity onPress={openNoteForSelection} style={styles.selectionAction}><Text style={styles.selectionActionText}>메모</Text></TouchableOpacity>",
  "            <TouchableOpacity onPress={copySelectedVerses} style={styles.selectionAction}><Text style={styles.selectionActionText}>복사</Text></TouchableOpacity>\n            <TouchableOpacity onPress={toggleBookmarkForSelection} style={styles.selectionAction}><Text style={styles.selectionActionText}>북마크</Text></TouchableOpacity>\n            <TouchableOpacity onPress={toggleHighlightForSelection} style={styles.selectionAction}><Text style={styles.selectionActionText}>형광펜</Text></TouchableOpacity>\n            <TouchableOpacity onPress={openNoteForSelection} style={styles.selectionAction}><Text style={styles.selectionActionText}>메모</Text></TouchableOpacity>",
  'selection actions',
);

replaceOnce(
  "                    style={[isTargetVerse && styles.targetVerseWrap, selectedVerses.some((x) => x.key === verseKey(v)) && styles.selectedVerseWrap]}",
  "                    style={[isTargetVerse && styles.targetVerseWrap, verseHighlights[verseKey(v)] && styles.highlightedVerseWrap, selectedVerses.some((x) => x.key === verseKey(v)) && styles.selectedVerseWrap]}",
  'highlight verse style',
);

replaceOnce(
  "                        {verseNotes[verseKey(v)] ? <Text onPress={() => openNoteForVerse(v)} style={styles.noteMark}>  📝</Text> : null}",
  "                        {verseBookmarks[verseKey(v)] ? <Text style={styles.noteMark}>  🔖</Text> : null}{verseNotes[verseKey(v)] ? <Text onPress={() => openNoteForVerse(v)} style={styles.noteMark}>  📝</Text> : null}",
  'bookmark verse mark',
);

replaceOnce(
  "          <TouchableOpacity onPress={() => setScreen('records')} style={[styles.tab, screen === 'records' && styles.tabActive]}><Text style={[styles.tabText, screen === 'records' && styles.tabTextActive]}>완료기록</Text></TouchableOpacity>",
  "          <TouchableOpacity onPress={() => { setMoreMode(null); setScreen('more'); }} style={[styles.tab, screen === 'more' && styles.tabActive]}><Text style={[styles.tabText, screen === 'more' && styles.tabTextActive]}>더보기</Text></TouchableOpacity>",
  'more top tab',
);

replaceOnce(
  "        ) : screen === 'settings' ? (",
  "        ) : screen === 'more' ? (\n          <ScrollView contentContainerStyle={styles.moreScreen}>\n            <View style={styles.moreHeaderRow}>\n              <View><Text style={styles.settingsTitle}>{moreMode ? (moreMode === 'bookmarks' ? '북마크 모아보기' : moreMode === 'highlights' ? '형광펜 모아보기' : '메모 모아보기') : '더보기'}</Text><Text style={styles.recordsSubtitle}>{moreMode ? '저장한 말씀을 한곳에서 확인합니다.' : '저장한 말씀과 메모를 모아볼 수 있습니다.'}</Text></View>\n              {moreMode ? <TouchableOpacity onPress={() => setMoreMode(null)} style={styles.moreBackButton}><Text style={styles.moreBackButtonText}>‹ 목록</Text></TouchableOpacity> : null}\n            </View>\n            {!moreMode ? (\n              <View style={styles.moreMenuCard}>\n                <TouchableOpacity onPress={() => setMoreMode('bookmarks')} style={styles.moreMenuRow}><View><Text style={styles.moreMenuTitle}>🔖 북마크 모아보기</Text><Text style={styles.moreMenuDescription}>저장한 말씀 {Object.keys(verseBookmarks).length}개</Text></View><Text style={styles.legalMenuArrow}>›</Text></TouchableOpacity>\n                <View style={styles.legalMenuDivider} />\n                <TouchableOpacity onPress={() => setMoreMode('highlights')} style={styles.moreMenuRow}><View><Text style={styles.moreMenuTitle}>🖍 형광펜 모아보기</Text><Text style={styles.moreMenuDescription}>표시한 말씀 {Object.keys(verseHighlights).length}개</Text></View><Text style={styles.legalMenuArrow}>›</Text></TouchableOpacity>\n                <View style={styles.legalMenuDivider} />\n                <TouchableOpacity onPress={() => setMoreMode('notes')} style={styles.moreMenuRow}><View><Text style={styles.moreMenuTitle}>📝 메모 모아보기</Text><Text style={styles.moreMenuDescription}>작성한 메모 {Object.keys(verseNotes).length}개</Text></View><Text style={styles.legalMenuArrow}>›</Text></TouchableOpacity>\n              </View>\n            ) : (\n              <View style={styles.savedVerseList}>\n                {Object.entries(moreMode === 'bookmarks' ? verseBookmarks : moreMode === 'highlights' ? verseHighlights : verseNotes).length ? Object.entries(moreMode === 'bookmarks' ? verseBookmarks : moreMode === 'highlights' ? verseHighlights : verseNotes).map(([key, value]) => {\n                  const parts = key.split(':');\n                  const label = value?.label || `${parts[1] || ''} ${parts[2] || ''}:${parts[3] || ''}`;\n                  const body = typeof value === 'string' ? value : (value?.text || '');\n                  return <View key={key} style={styles.savedVerseCard}><Text style={styles.savedVerseLabel}>{label}</Text><Text style={styles.savedVerseText}>{body}</Text>{value?.savedAt ? <Text style={styles.savedVerseDate}>{value.savedAt}</Text> : null}</View>;\n                }) : <View style={styles.emptyCard}><Text style={styles.emptyText}>아직 저장된 내용이 없습니다.</Text></View>}\n              </View>\n            )}\n          </ScrollView>\n        ) : screen === 'settings' ? (",
  'more screen',
);

replaceOnce(
  "                <View style={styles.memberProfileActions}><TouchableOpacity onPress={() => openNicknameEditor()} style={styles.memberProfileButton}><Text style={styles.memberProfileButtonText}>{currentMembership?.nickname ? '닉네임 변경' : '닉네임 등록'}</Text></TouchableOpacity><TouchableOpacity onPress={leaveCurrentGroup} style={styles.memberLeaveButton}><Text style={styles.memberLeaveButtonText}>그룹 탈퇴</Text></TouchableOpacity></View>",
  "                <View style={styles.memberProfileActions}><TouchableOpacity onPress={() => openNicknameEditor()} style={styles.memberProfileButton}><Text style={styles.memberProfileButtonText}>{currentMembership?.nickname ? '닉네임 변경' : '닉네임 등록'}</Text></TouchableOpacity><TouchableOpacity onPress={leaveCurrentGroup} style={styles.memberLeaveButton}><Text style={styles.memberLeaveButtonText}>그룹 탈퇴</Text></TouchableOpacity></View>\n                <TouchableOpacity onPress={() => shareGroupInvite(currentGroup)} style={styles.shareInviteButton}><Text style={styles.shareInviteButtonText}>초대 코드 보내기</Text></TouchableOpacity>",
  'member invite share button',
);

replaceOnce(
  "  const shareGroupInvite = async (group = adminGroup || currentGroup) => {\n    const code = group?.normalizedInviteCode;\n    if (!code) {\n      Alert.alert('초대 코드 없음', '먼저 초대 코드를 설정해 주세요.');\n      return;\n    }\n    try {\n      await Share.share({\n        title: `${group.name} 초대`,\n        message: `${group.name}에 초대합니다.\\n연대기별 성경통독 일정표 앱에서 아래 초대 코드를 입력해 주세요.\\n\\n초대 코드: ${code}`,\n      });\n    } catch (error) {\n      console.warn('Invite share failed:', error);\n      Alert.alert('공유 실패', '초대 코드를 공유하지 못했습니다.');\n    }\n  };",
  "  const shareGroupInvite = async (group = adminGroup || currentGroup) => {\n    const code = group?.normalizedInviteCode;\n    if (!code) {\n      Alert.alert('초대 코드 없음', '먼저 초대 코드를 설정해 주세요.');\n      return;\n    }\n    Alert.alert('초대 코드 보내기', `「${group.name}」의 초대 코드를 보내시려는 게 맞습니까?`, [\n      { text: '아니오', style: 'cancel' },\n      { text: '예', onPress: async () => {\n        try {\n          await Share.share({\n            title: `${group.name} 초대`,\n            message: `${group.name}에 초대합니다.\\nGF 바이블 앱에서 아래 초대 코드를 입력해 주세요.\\n\\n초대 코드: ${code}`,\n          });\n        } catch (error) {\n          console.warn('Invite share failed:', error);\n          Alert.alert('공유 실패', '초대 코드를 공유하지 못했습니다.');\n        }\n      } },\n    ]);\n  };",
  'invite confirmation',
);

replaceOnce(
  "  selectionBar: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#17223B', flexDirection: 'row', alignItems: 'center', gap: 8 },",
  "  selectionBar: { paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#17223B', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },",
  'selection bar wrapping',
);

replaceOnce(
  "  selectionCount: { color: '#FFF', fontWeight: '900', marginRight: 'auto' }, selectionAction: { backgroundColor: '#FFF', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9 },",
  "  selectionCount: { color: '#FFF', fontWeight: '900', marginRight: 'auto' }, selectionAction: { backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },",
  'selection action size',
);

replaceOnce(
  "  selectionClear: { paddingHorizontal: 8, paddingVertical: 8 }, selectionClearText: { color: '#E9D5A9', fontWeight: '900' }, selectedVerseWrap: { backgroundColor: '#DCEBFA', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 }, noteMark: { fontSize: 13 },",
  "  selectionClear: { paddingHorizontal: 8, paddingVertical: 8 }, selectionClearText: { color: '#E9D5A9', fontWeight: '900' }, highlightedVerseWrap: { backgroundColor: '#FFF3A8', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 }, selectedVerseWrap: { backgroundColor: '#DCEBFA', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 }, noteMark: { fontSize: 13 },",
  'highlight style',
);

replaceOnce(
  "  settingsScreen: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 80 },",
  "  settingsScreen: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 80 },\n  moreScreen: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 80 }, moreHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }, moreBackButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#E9E5DC' }, moreBackButtonText: { color: '#655332', fontSize: 12, fontWeight: '900' }, moreMenuCard: { borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E2D8', overflow: 'hidden' }, moreMenuRow: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, moreMenuTitle: { color: '#17223B', fontSize: 16, fontWeight: '900' }, moreMenuDescription: { marginTop: 4, color: '#7A7F87', fontSize: 11, fontWeight: '700' }, savedVerseList: { gap: 10 }, savedVerseCard: { padding: 16, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E2D8' }, savedVerseLabel: { color: '#8B6B35', fontSize: 13, fontWeight: '900', marginBottom: 7 }, savedVerseText: { color: '#303B52', fontSize: 14, lineHeight: 21, fontWeight: '700' }, savedVerseDate: { marginTop: 8, color: '#93979E', fontSize: 10, fontWeight: '700' },",
  'more styles',
);

fs.writeFileSync(path, source);
console.log('GF Bible stage2 patch applied successfully.');
