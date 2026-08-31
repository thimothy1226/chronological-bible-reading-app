import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, BackHandler, FlatList, Platform, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import schedule from './assets/schedule.json';
import translations from './assets/bibles/translations.json';
import krv from './assets/bibles/krv.json';

const CURRENT_DAY_KEY = '@chronological_bible/current_day';
const COMPLETIONS_KEY = '@chronological_bible/completions';
const TRANSLATION_KEY = '@chronological_bible/translation';
const FONT_SIZE_KEY = '@chronological_bible/font_size';

const BIBLE_DATA = { KRV: krv };

const formatKoreanDateTime = (date = new Date()) => {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
};

function normalizeBooks(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.books)) return data.books;
  if (data?.book && data?.chapters) return [data];
  return [];
}

function getBook(data, englishName, koreanName) {
  const books = normalizeBooks(data);
  return books.find((b) =>
    b.book === englishName ||
    b.name === englishName ||
    b.koreanTitle === koreanName ||
    b.title === koreanName
  );
}

function getVersesForPassage(data, passage) {
  const book = getBook(data, passage.book, passage.bookKo);
  if (!book) return [];
  const result = [];
  for (let chapterNo = passage.startChapter; chapterNo <= passage.endChapter; chapterNo += 1) {
    const chapter = (book.chapters || []).find((c) => Number(c.chapter) === chapterNo);
    if (!chapter) continue;
    const verses = chapter.verses || [];
    for (const verse of verses) {
      const n = Number(verse.verse);
      const isFirst = chapterNo === passage.startChapter;
      const isLast = chapterNo === passage.endChapter;
      if (isFirst && passage.startVerse && n < passage.startVerse) continue;
      if (isLast && passage.endVerse && n > passage.endVerse) continue;
      result.push({
        bookKo: passage.bookKo,
        chapter: chapterNo,
        verse: n,
        text: verse.text ?? verse.hangulText ?? '',
      });
    }
  }
  return result;
}

export default function App() {
  const [screen, setScreen] = useState('today');
  const [currentDay, setCurrentDay] = useState(1);
  const [completions, setCompletions] = useState({});
  const [translationId, setTranslationId] = useState('KRV');
  const [fontSize, setFontSize] = useState(19);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await AsyncStorage.multiGet([
          CURRENT_DAY_KEY, COMPLETIONS_KEY, TRANSLATION_KEY, FONT_SIZE_KEY,
        ]);
        const saved = Object.fromEntries(rows);
        const d = Number(saved[CURRENT_DAY_KEY] || 1);
        setCurrentDay(Number.isFinite(d) && d >= 1 && d <= 365 ? d : 1);
        setCompletions(saved[COMPLETIONS_KEY] ? JSON.parse(saved[COMPLETIONS_KEY]) : {});
        setTranslationId(saved[TRANSLATION_KEY] || 'KRV');
        const f = Number(saved[FONT_SIZE_KEY] || 19);
        setFontSize(Number.isFinite(f) ? Math.min(30, Math.max(15, f)) : 19);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const current = schedule[currentDay - 1];
  const completedCount = Object.keys(completions).length;
  const isAllDone = completedCount >= schedule.length;
  const progress = completedCount / schedule.length;
  const selectedTranslation = translations.find(t => t.id === translationId) || translations[0];

  const completedRows = useMemo(
    () => schedule.filter(i => completions[String(i.day)]).map(i => ({...i, completedAt: completions[String(i.day)]})),
    [completions]
  );

  const bibleSections = useMemo(() => {
    if (!current) return [];
    const data = BIBLE_DATA[translationId];
    return current.passages.map((p) => ({
      passage: p,
      title: current.reading,
      verses: getVersesForPassage(data, p),
    }));
  }, [current, translationId]);

  const completeToday = async () => {
    if (!current || isAllDone || completions[String(current.day)]) return;
    const completedAt = formatKoreanDateTime();
    const next = {...completions, [String(current.day)]: completedAt};
    const nextDay = current.day < schedule.length ? current.day + 1 : current.day;
    await AsyncStorage.multiSet([
      [COMPLETIONS_KEY, JSON.stringify(next)],
      [CURRENT_DAY_KEY, String(nextDay)],
    ]);
    setCompletions(next);
    setCurrentDay(nextDay);
    setScreen('today');
    if (current.day === schedule.length) Alert.alert('통독 완료', '365일 연대기별 성경통독 일정을 모두 완료했습니다.');
  };

  const changeFont = async (delta) => {
    const next = Math.min(30, Math.max(15, fontSize + delta));
    setFontSize(next);
    await AsyncStorage.setItem(FONT_SIZE_KEY, String(next));
  };

  const cycleTranslation = async () => {
    const enabled = translations.filter(t => t.enabled);
    if (enabled.length <= 1) {
      Alert.alert('번역본 선택', '현재는 개역한글만 설치되어 있습니다. 추후 번역본을 추가하면 이 버튼에서 선택할 수 있습니다.');
      return;
    }
    const idx = enabled.findIndex(t => t.id === translationId);
    const next = enabled[(idx + 1) % enabled.length];
    setTranslationId(next.id);
    await AsyncStorage.setItem(TRANSLATION_KEY, next.id);
  };

  const exitApp = () => {
    if (Platform.OS === 'android') BackHandler.exitApp();
    else Alert.alert('종료 안내', 'iPhone에서는 홈 화면으로 이동해 주세요.');
  };

  if (!loaded) return <SafeAreaView style={styles.safeArea}><View style={styles.loadingWrap}><Text>일정을 불러오는 중...</Text></View></SafeAreaView>;

  if (screen === 'bible') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.bibleHeader}>
          <TouchableOpacity onPress={() => setScreen('today')} style={styles.backButton}><Text style={styles.backText}>‹ 오늘 일정</Text></TouchableOpacity>
          <Text style={styles.bibleTitle}>{current.dayLabel} 본문</Text>
        </View>
        <View style={styles.readerTools}>
          <TouchableOpacity onPress={cycleTranslation} style={styles.translationButton}>
            <Text style={styles.translationText}>번역본: {selectedTranslation.name} ▼</Text>
          </TouchableOpacity>
          <View style={styles.fontTools}>
            <TouchableOpacity onPress={() => changeFont(-2)} style={styles.fontButton}><Text style={styles.fontButtonText}>A−</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => changeFont(2)} style={styles.fontButton}><Text style={styles.fontButtonText}>A+</Text></TouchableOpacity>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.readerContent}>
          <Text style={styles.readerRange}>{current.reading}</Text>
          {bibleSections.map((section, sidx) => (
            <View key={sidx} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.passage.bookKo} {section.passage.startChapter}{section.passage.startChapter === section.passage.endChapter ? '장' : `장~${section.passage.endChapter}장`}</Text>
              {section.verses.length === 0 ? (
                <Text style={styles.missingText}>본문 데이터를 찾지 못했습니다.</Text>
              ) : section.verses.map((v, idx) => {
                const prev = section.verses[idx-1];
                const showChapter = !prev || prev.chapter !== v.chapter;
                return (
                  <View key={`${v.bookKo}-${v.chapter}-${v.verse}`}>
                    {showChapter && <Text style={styles.chapterHeading}>{v.bookKo} {v.chapter}장</Text>}
                    <Text style={[styles.verseText, {fontSize, lineHeight: Math.round(fontSize * 1.7)}]}>
                      <Text style={styles.verseNumber}>{v.verse} </Text>{v.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={styles.sourceBox}>
            <Text style={styles.sourceText}>성경전서 개역한글판 (1961) · 본문 출처 표시 및 동일성 유지</Text>
          </View>
          <TouchableOpacity onPress={completeToday} style={styles.completeButton}>
            <Text style={styles.completeButtonText}>✓ 오늘 통독 완료</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.app}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>365-DAY BIBLE READING</Text><Text style={styles.title}>연대기별 성경통독 일정표</Text></View>
          <TouchableOpacity onPress={exitApp} style={styles.exitButton}><Text style={styles.exitButtonText}>종료</Text></TouchableOpacity>
        </View>
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setScreen('today')} style={[styles.tab, screen==='today'&&styles.tabActive]}><Text style={[styles.tabText, screen==='today'&&styles.tabTextActive]}>오늘 일정</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('records')} style={[styles.tab, screen==='records'&&styles.tabActive]}><Text style={[styles.tabText, screen==='records'&&styles.tabTextActive]}>완료 기록</Text></TouchableOpacity>
        </View>
        {screen==='today' ? (
          <View style={styles.content}>
            <View style={styles.progressBlock}><View style={styles.progressTextRow}><Text style={styles.progressLabel}>통독 진행률</Text><Text style={styles.progressValue}>{completedCount} / 365</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${Math.min(progress*100,100)}%`}]} /></View></View>
            {isAllDone ? <View style={styles.finishCard}><Text style={styles.finishIcon}>✓</Text><Text style={styles.finishTitle}>365일 통독 완료</Text></View> :
            <View style={styles.card}>
              <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>{current.dayLabel}</Text></View>
              <Text style={styles.stage}>{current.stage}</Text><View style={styles.divider}/>
              <Text style={styles.readingLabel}>오늘 읽을 말씀</Text>
              <TouchableOpacity onPress={() => setScreen('bible')} style={styles.readingButton}>
                <Text style={styles.reading}>{current.reading}</Text>
                <Text style={styles.tapHint}>본문 읽기 ›</Text>
              </TouchableOpacity>
              <View style={styles.noteBox}><Text style={styles.noteText}>읽을 말씀을 누르면 개역한글 본문이 열립니다. 완료를 눌러야 다음 Day로 넘어갑니다.</Text></View>
              <TouchableOpacity onPress={completeToday} style={styles.completeButton}><Text style={styles.completeButtonText}>✓ 오늘 통독 완료</Text></TouchableOpacity>
            </View>}
          </View>
        ) : (
          <View style={styles.recordsWrap}>
            <View style={styles.recordsHeader}><View><Text style={styles.recordsTitle}>완료 기록</Text><Text style={styles.recordsSubtitle}>완료한 날짜와 읽기 범위를 확인할 수 있습니다.</Text></View><View style={styles.countPill}><Text style={styles.countPillText}>{completedCount}일</Text></View></View>
            <FlatList data={completedRows} keyExtractor={i=>String(i.day)} contentContainerStyle={styles.listContent} renderItem={({item})=><View style={styles.recordCard}><View style={styles.recordTopRow}><Text style={styles.recordDay}>{item.dayLabel}</Text><Text style={styles.recordDate}>{item.completedAt}</Text></View><Text style={styles.recordStage}>{item.stage}</Text><Text style={styles.recordReading}>{item.reading}</Text></View>} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#F7F6F1'},app:{flex:1},loadingWrap:{flex:1,alignItems:'center',justifyContent:'center'},
  header:{paddingHorizontal:22,paddingTop:18,paddingBottom:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  eyebrow:{fontSize:10,letterSpacing:1.6,fontWeight:'800',color:'#9A7C43',marginBottom:5},title:{fontSize:22,lineHeight:29,fontWeight:'900',color:'#17223B'},
  exitButton:{borderWidth:1,borderColor:'#D6D2C8',borderRadius:12,paddingHorizontal:14,paddingVertical:9,backgroundColor:'#FFF'},exitButtonText:{color:'#5B6471',fontWeight:'800',fontSize:13},
  tabs:{marginHorizontal:22,flexDirection:'row',padding:4,borderRadius:14,backgroundColor:'#EAE8E1'},tab:{flex:1,paddingVertical:10,borderRadius:11,alignItems:'center'},tabActive:{backgroundColor:'#FFF'},tabText:{color:'#7A7F87',fontWeight:'800',fontSize:14},tabTextActive:{color:'#17223B'},
  content:{flex:1,paddingHorizontal:22,paddingTop:22},progressBlock:{marginBottom:18},progressTextRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},progressLabel:{fontSize:13,fontWeight:'800',color:'#626A75'},progressValue:{fontSize:13,fontWeight:'900',color:'#17223B'},
  progressTrack:{height:8,borderRadius:99,backgroundColor:'#E3E0D7',overflow:'hidden'},progressFill:{height:'100%',borderRadius:99,backgroundColor:'#B28A48'},
  card:{backgroundColor:'#FFF',borderRadius:24,padding:22,borderWidth:1,borderColor:'#ECE8DE'},dayBadge:{alignSelf:'flex-start',backgroundColor:'#17223B',borderRadius:99,paddingHorizontal:14,paddingVertical:8,marginBottom:16},dayBadgeText:{color:'#FFF',fontWeight:'900'},
  stage:{fontSize:15,lineHeight:22,fontWeight:'800',color:'#9A7C43'},divider:{height:1,backgroundColor:'#EEEAE1',marginVertical:18},readingLabel:{fontSize:13,fontWeight:'800',color:'#747C86',marginBottom:8},
  readingButton:{borderRadius:16,paddingVertical:6},reading:{fontSize:24,lineHeight:35,fontWeight:'900',color:'#17223B',letterSpacing:-0.5},tapHint:{marginTop:8,color:'#9A7C43',fontWeight:'900'},
  noteBox:{marginTop:22,padding:14,borderRadius:14,backgroundColor:'#F6F1E7'},noteText:{fontSize:12,lineHeight:18,color:'#6E675B',fontWeight:'600'},
  completeButton:{marginTop:18,paddingVertical:16,borderRadius:16,alignItems:'center',backgroundColor:'#B28A48'},completeButtonText:{color:'#FFF',fontSize:16,fontWeight:'900'},
  finishCard:{backgroundColor:'#FFF',borderRadius:24,padding:28,alignItems:'center'},finishIcon:{fontSize:42,color:'#B28A48'},finishTitle:{fontSize:23,fontWeight:'900',color:'#17223B'},
  recordsWrap:{flex:1,paddingTop:22},recordsHeader:{paddingHorizontal:22,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14},recordsTitle:{fontSize:21,fontWeight:'900',color:'#17223B'},recordsSubtitle:{fontSize:12,color:'#747C86',marginTop:3},countPill:{backgroundColor:'#F0E7D6',paddingHorizontal:12,paddingVertical:8,borderRadius:99},countPillText:{color:'#8B6B35',fontWeight:'900'},
  listContent:{paddingHorizontal:22,paddingBottom:28},recordCard:{backgroundColor:'#FFF',borderRadius:17,padding:16,marginBottom:10},recordTopRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:7},recordDay:{fontSize:14,fontWeight:'900',color:'#17223B'},recordDate:{fontSize:11,fontWeight:'800',color:'#9A7C43'},recordStage:{fontSize:11,color:'#838993',marginBottom:4},recordReading:{fontSize:15,lineHeight:21,fontWeight:'800',color:'#303B52'},
  bibleHeader:{paddingHorizontal:18,paddingVertical:14,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#E8E4DA'},backButton:{paddingVertical:8,paddingRight:12},backText:{fontSize:15,fontWeight:'900',color:'#9A7C43'},bibleTitle:{fontSize:18,fontWeight:'900',color:'#17223B'},
  readerTools:{paddingHorizontal:18,paddingVertical:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:'#FFF'},translationButton:{paddingHorizontal:13,paddingVertical:10,borderRadius:12,backgroundColor:'#F5F1E8'},translationText:{fontWeight:'900',color:'#17223B'},fontTools:{flexDirection:'row',gap:8},fontButton:{paddingHorizontal:12,paddingVertical:9,borderRadius:10,backgroundColor:'#17223B'},fontButtonText:{color:'#FFF',fontWeight:'900'},
  readerContent:{padding:20,paddingBottom:40},readerRange:{fontSize:21,lineHeight:31,fontWeight:'900',color:'#17223B',marginBottom:20},section:{marginBottom:18},sectionHeading:{fontSize:16,fontWeight:'900',color:'#9A7C43',marginBottom:8},chapterHeading:{fontSize:19,fontWeight:'900',color:'#17223B',marginTop:18,marginBottom:8},
  verseText:{color:'#2E374A',marginBottom:10},verseNumber:{fontWeight:'900',color:'#9A7C43'},missingText:{color:'#A24A4A',fontWeight:'700'},sourceBox:{marginTop:12,padding:14,borderRadius:12,backgroundColor:'#F0EEE7'},sourceText:{fontSize:11,lineHeight:17,color:'#6B6F75'},
});
