import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, BackHandler, FlatList, Modal, Platform, SafeAreaView, ScrollView, StatusBar,
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
const READER_POSITIONS_KEY = '@chronological_bible/reader_positions';

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

function migrateCompletions(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(raw).forEach(([day, value]) => {
    if (typeof value === 'string') {
      out[day] = { active: true, dates: [value] };
      return;
    }
    if (value && typeof value === 'object') {
      const dates = Array.isArray(value.dates)
        ? value.dates.filter(Boolean)
        : (value.completedAt ? [value.completedAt] : []);
      out[day] = {
        active: value.active !== false,
        dates,
        canceledAt: value.canceledAt || null,
      };
    }
  });
  return out;
}

export default function App() {
  const [screen, setScreen] = useState('today');
  const [currentDay, setCurrentDay] = useState(1);
  const [displayDay, setDisplayDay] = useState(1);
  const [completions, setCompletions] = useState({});
  const [translationId, setTranslationId] = useState('KRV');
  const [fontSize, setFontSize] = useState(19);
  const [readerPositions, setReaderPositions] = useState({});
  const [readerContext, setReaderContext] = useState(null);
  const [readerReturnScreen, setReaderReturnScreen] = useState('today');
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVerse, setSelectedVerse] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const readerRef = useRef(null);
  const lastScrollY = useRef(0);
  const pendingTargetY = useRef(null);
  const restoredKey = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await AsyncStorage.multiGet([
          CURRENT_DAY_KEY, COMPLETIONS_KEY, TRANSLATION_KEY, FONT_SIZE_KEY, READER_POSITIONS_KEY,
        ]);
        const saved = Object.fromEntries(rows);
        const d = Number(saved[CURRENT_DAY_KEY] || 1);
        const safeDay = Number.isFinite(d) && d >= 1 && d <= 365 ? d : 1;
        setCurrentDay(safeDay);
        setDisplayDay(safeDay);
        const migrated = migrateCompletions(saved[COMPLETIONS_KEY] ? JSON.parse(saved[COMPLETIONS_KEY]) : {});
        setCompletions(migrated);
        setTranslationId(saved[TRANSLATION_KEY] || 'KRV');
        const f = Number(saved[FONT_SIZE_KEY] || 19);
        setFontSize(Number.isFinite(f) ? Math.min(30, Math.max(15, f)) : 19);
        setReaderPositions(saved[READER_POSITIONS_KEY] ? JSON.parse(saved[READER_POSITIONS_KEY]) : {});
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const displayed = schedule[displayDay - 1];
  const completedCount = Object.values(completions).filter((x) => x?.active).length;
  const progress = completedCount / schedule.length;
  const selectedTranslation = translations.find((t) => t.id === translationId) || translations[0];

  const completedRows = useMemo(() => (
    schedule
      .filter((i) => completions[String(i.day)]?.dates?.length)
      .map((i) => ({ ...i, completion: completions[String(i.day)] }))
      .sort((a, b) => b.day - a.day)
  ), [completions]);

  const bibleBooks = useMemo(() => normalizeBooks(BIBLE_DATA[translationId]), [translationId]);
  const selectedBook = bibleBooks[selectedBookIndex] || bibleBooks[0];
  const chapterCount = selectedBook?.chapters?.length || 1;
  const selectedChapterData = (selectedBook?.chapters || []).find((c) => Number(c.chapter) === selectedChapter) || selectedBook?.chapters?.[0];
  const verseCount = selectedChapterData?.verses?.length || 1;

  useEffect(() => {
    if (selectedChapter > chapterCount) setSelectedChapter(1);
  }, [selectedBookIndex, chapterCount, selectedChapter]);

  useEffect(() => {
    if (selectedVerse > verseCount) setSelectedVerse(1);
  }, [selectedChapter, verseCount, selectedVerse]);

  const readerKey = useMemo(() => {
    if (!readerContext) return null;
    if (readerContext.type === 'day') return `day:${readerContext.day}:${translationId}`;
    return `chapter:${readerContext.book}:${readerContext.chapter}:${translationId}`;
  }, [readerContext, translationId]);

  const readerSections = useMemo(() => {
    if (!readerContext) return [];
    const data = BIBLE_DATA[translationId];
    if (readerContext.type === 'day') {
      const item = schedule[readerContext.day - 1];
      return (item?.passages || []).map((p) => ({
        passage: p,
        verses: getVersesForPassage(data, p),
      }));
    }
    const book = getBook(data, readerContext.book, readerContext.bookKo);
    const chapter = (book?.chapters || []).find((c) => Number(c.chapter) === readerContext.chapter);
    const verses = (chapter?.verses || []).map((v) => ({
      bookKo: readerContext.bookKo,
      chapter: readerContext.chapter,
      verse: Number(v.verse),
      text: v.text ?? v.hangulText ?? '',
    }));
    return [{
      passage: {
        book: readerContext.book,
        bookKo: readerContext.bookKo,
        startChapter: readerContext.chapter,
        endChapter: readerContext.chapter,
      },
      verses,
    }];
  }, [readerContext, translationId]);

  const readerTitle = useMemo(() => {
    if (!readerContext) return '';
    if (readerContext.type === 'day') {
      const item = schedule[readerContext.day - 1];
      return `${item?.dayLabel || ''} 본문`;
    }
    return `${readerContext.bookKo} ${readerContext.chapter}장`;
  }, [readerContext]);

  const readerRange = useMemo(() => {
    if (!readerContext) return '';
    if (readerContext.type === 'day') return schedule[readerContext.day - 1]?.reading || '';
    return `${readerContext.bookKo} ${readerContext.chapter}장`;
  }, [readerContext]);

  const persistPositions = async (next) => {
    setReaderPositions(next);
    await AsyncStorage.setItem(READER_POSITIONS_KEY, JSON.stringify(next));
  };

  const saveCurrentPosition = async () => {
    if (!readerKey) return;
    const next = { ...readerPositions, [readerKey]: lastScrollY.current || 0 };
    await persistPositions(next);
  };

  const openDayReader = (day, returnTo = 'today') => {
    setReaderReturnScreen(returnTo);
    setReaderContext({ type: 'day', day });
    restoredKey.current = null;
    pendingTargetY.current = null;
    setScreen('reader');
  };

  const openChapterReader = () => {
    if (!selectedBook) return;
    const bookKo = selectedBook.koreanTitle || selectedBook.title || selectedBook.name || selectedBook.book;
    setReaderReturnScreen('bibleIndex');
    setReaderContext({
      type: 'chapter',
      book: selectedBook.book || selectedBook.name,
      bookKo,
      chapter: selectedChapter,
      verse: selectedVerse,
    });
    restoredKey.current = null;
    pendingTargetY.current = null;
    setScreen('reader');
  };

  const closeReader = async (destination = readerReturnScreen) => {
    await saveCurrentPosition();
    setScreen(destination);
  };

  const completeDay = async (day, advanceIfCurrent = false) => {
    const key = String(day);
    const completedAt = formatKoreanDateTime();
    const existing = completions[key] || { active: false, dates: [] };
    const next = {
      ...completions,
      [key]: {
        active: true,
        dates: [...(existing.dates || []), completedAt],
        canceledAt: null,
      },
    };

    let nextDay = currentDay;
    if (advanceIfCurrent && day === currentDay && currentDay < schedule.length) nextDay = currentDay + 1;

    await AsyncStorage.multiSet([
      [COMPLETIONS_KEY, JSON.stringify(next)],
      [CURRENT_DAY_KEY, String(nextDay)],
    ]);
    setCompletions(next);
    setCurrentDay(nextDay);

    if (advanceIfCurrent && day === currentDay) {
      if (day === schedule.length) {
        Alert.alert('통독 완료', '365일 연대기별 성경통독 일정을 모두 완료했습니다.');
      } else {
        setDisplayDay(nextDay);
      }
      setScreen('today');
    } else if (readerReturnScreen === 'records') {
      setScreen('records');
    } else {
      setScreen('today');
    }
  };

  const cancelCompletion = (day) => {
    Alert.alert(
      '완료 취소',
      `${schedule[day - 1]?.dayLabel} 완료 표시를 취소할까요?\n오늘 일정은 그대로 유지됩니다.`,
      [
        { text: '아니요', style: 'cancel' },
        {
          text: '완료 취소', style: 'destructive', onPress: async () => {
            const key = String(day);
            const existing = completions[key];
            if (!existing) return;
            const next = {
              ...completions,
              [key]: { ...existing, active: false, canceledAt: formatKoreanDateTime() },
            };
            await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(next));
            setCompletions(next);
          },
        },
      ],
    );
  };

  const changeFont = async (delta) => {
    const next = Math.min(30, Math.max(15, fontSize + delta));
    setFontSize(next);
    await AsyncStorage.setItem(FONT_SIZE_KEY, String(next));
  };

  const cycleTranslation = async () => {
    const enabled = translations.filter((t) => t.enabled);
    if (enabled.length <= 1) {
      Alert.alert('번역본 선택', '현재는 개역한글만 설치되어 있습니다. 추후 번역본을 추가하면 이 버튼에서 선택할 수 있습니다.');
      return;
    }
    const idx = enabled.findIndex((t) => t.id === translationId);
    const next = enabled[(idx + 1) % enabled.length];
    setTranslationId(next.id);
    await AsyncStorage.setItem(TRANSLATION_KEY, next.id);
  };

  const exitApp = () => {
    if (Platform.OS === 'android') BackHandler.exitApp();
    else Alert.alert('종료 안내', 'iPhone에서는 홈 화면으로 이동해 주세요.');
  };

  const chooseDay = (day) => {
    setDisplayDay(day);
    setDayPickerOpen(false);
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.loadingWrap}><Text>일정을 불러오는 중...</Text></View></SafeAreaView>;
  }

  if (screen === 'reader' && readerContext) {
    const savedY = readerKey ? (readerPositions[readerKey] || 0) : 0;
    const dayItem = readerContext.type === 'day' ? schedule[readerContext.day - 1] : null;
    const dayCompletion = dayItem ? completions[String(dayItem.day)] : null;
    const isCurrentReaderDay = dayItem?.day === currentDay;

    const handleContentReady = () => {
      if (!readerKey || restoredKey.current === readerKey) return;
      restoredKey.current = readerKey;
      setTimeout(() => {
        const target = pendingTargetY.current ?? savedY;
        readerRef.current?.scrollTo({ y: target || 0, animated: false });
        lastScrollY.current = target || 0;
      }, 120);
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.bibleHeader}>
          <TouchableOpacity onPress={() => closeReader(readerReturnScreen)} style={styles.backButton}>
            <Text style={styles.backText}>‹ 이전</Text>
          </TouchableOpacity>
          <Text style={styles.bibleTitle} numberOfLines={1}>{readerTitle}</Text>
          <TouchableOpacity onPress={() => closeReader('today')} style={styles.homeButton}>
            <Text style={styles.homeButtonText}>홈</Text>
          </TouchableOpacity>
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
        <ScrollView
          ref={readerRef}
          contentContainerStyle={styles.readerContent}
          onContentSizeChange={handleContentReady}
          onScroll={(e) => { lastScrollY.current = e.nativeEvent.contentOffset.y; }}
          onScrollEndDrag={saveCurrentPosition}
          onMomentumScrollEnd={saveCurrentPosition}
          scrollEventThrottle={80}
        >
          <Text style={styles.readerRange}>{readerRange}</Text>
          {readerSections.map((section, sidx) => (
            <View key={sidx} style={styles.section}>
              {section.verses.length === 0 ? (
                <Text style={styles.missingText}>본문 데이터를 찾지 못했습니다.</Text>
              ) : section.verses.map((v, idx) => {
                const prev = section.verses[idx - 1];
                const showChapter = !prev || prev.chapter !== v.chapter;
                const isTargetVerse = readerContext.type === 'chapter' && v.verse === readerContext.verse;
                return (
                  <View
                    key={`${v.bookKo}-${v.chapter}-${v.verse}`}
                    onLayout={(e) => {
                      if (isTargetVerse && !savedY) {
                        const targetY = Math.max(0, e.nativeEvent.layout.y + 72);
                        pendingTargetY.current = targetY;
                        setTimeout(() => {
                          readerRef.current?.scrollTo({ y: targetY, animated: false });
                          lastScrollY.current = targetY;
                        }, 180);
                      }
                    }}
                    style={isTargetVerse ? styles.targetVerseWrap : null}
                  >
                    {showChapter && <Text style={styles.chapterHeading}>{v.bookKo} {v.chapter}장</Text>}
                    <Text style={[styles.verseText, { fontSize, lineHeight: Math.round(fontSize * 1.7) }]}>
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
          {readerContext.type === 'day' && (
            <TouchableOpacity
              onPress={() => completeDay(dayItem.day, isCurrentReaderDay)}
              style={styles.completeButton}
            >
              <Text style={styles.completeButtonText}>
                {isCurrentReaderDay ? '✓ 오늘 통독 완료' : dayCompletion?.active ? '✓ 완료 날짜 추가' : '✓ 이 일정 완료'}
              </Text>
            </TouchableOpacity>
          )}
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
          <TouchableOpacity onPress={() => setScreen('bibleIndex')} style={[styles.tab, screen === 'bibleIndex' && styles.tabActive]}><Text style={[styles.tabText, screen === 'bibleIndex' && styles.tabTextActive]}>성경보기</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setDisplayDay(currentDay); setScreen('today'); }} style={[styles.tab, screen === 'today' && styles.tabActive]}><Text style={[styles.tabText, screen === 'today' && styles.tabTextActive]}>오늘 일정</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('records')} style={[styles.tab, screen === 'records' && styles.tabActive]}><Text style={[styles.tabText, screen === 'records' && styles.tabTextActive]}>완료 기록</Text></TouchableOpacity>
        </View>

        {screen === 'today' && displayed ? (
          <View style={styles.content}>
            <View style={styles.progressBlock}>
              <View style={styles.progressTextRow}><Text style={styles.progressLabel}>통독 진행률</Text><Text style={styles.progressValue}>{completedCount} / 365</Text></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} /></View>
            </View>

            <View style={styles.card}>
              <TouchableOpacity onPress={() => setDayPickerOpen(true)} style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{displayed.dayLabel} ▼</Text>
              </TouchableOpacity>
              {displayDay !== currentDay && (
                <View style={styles.pastNotice}>
                  <Text style={styles.pastNoticeText}>지난 일정 보기 · 오늘 일정은 {schedule[currentDay - 1]?.dayLabel} 그대로 유지됩니다.</Text>
                  <TouchableOpacity onPress={() => setDisplayDay(currentDay)}><Text style={styles.returnTodayText}>오늘로 돌아가기</Text></TouchableOpacity>
                </View>
              )}
              <Text style={styles.stage}>{displayed.stage}</Text>
              <View style={styles.divider} />
              <Text style={styles.readingLabel}>{displayDay === currentDay ? '오늘 읽을 말씀' : '선택한 날 읽을 말씀'}</Text>
              <TouchableOpacity onPress={() => openDayReader(displayDay, 'today')} style={styles.readingButton}>
                <Text style={styles.reading}>{displayed.reading}</Text>
                <Text style={styles.tapHint}>본문 읽기 ›</Text>
              </TouchableOpacity>
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>Day 번호를 누르면 지나간 일정을 불러올 수 있습니다. 지난 일정을 완료해도 오늘 일정은 뒤로 돌아가지 않습니다.</Text>
              </View>
              <TouchableOpacity onPress={() => completeDay(displayDay, displayDay === currentDay)} style={styles.completeButton}>
                <Text style={styles.completeButtonText}>{displayDay === currentDay ? '✓ 오늘 통독 완료' : '✓ 선택한 일정 완료'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : screen === 'records' ? (
          <View style={styles.recordsWrap}>
            <View style={styles.recordsHeader}>
              <View><Text style={styles.recordsTitle}>완료 기록</Text><Text style={styles.recordsSubtitle}>완료 취소 후에도 기록은 남고, 다시 읽어 완료할 수 있습니다.</Text></View>
              <View style={styles.countPill}><Text style={styles.countPillText}>{completedCount}일</Text></View>
            </View>
            <FlatList
              data={completedRows}
              keyExtractor={(i) => String(i.day)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyText}>아직 완료 기록이 없습니다.</Text></View>}
              renderItem={({ item }) => {
                const active = item.completion?.active !== false;
                const dates = item.completion?.dates || [];
                return (
                  <View style={[styles.recordCard, !active && styles.recordCardCanceled]}>
                    <View style={styles.recordTopRow}>
                      <Text style={[styles.recordDay, !active && styles.mutedText]}>{item.dayLabel}</Text>
                      <Text style={[styles.recordStatus, !active && styles.canceledStatus]}>{active ? '완료' : '완료 취소'}</Text>
                    </View>
                    <Text style={[styles.recordStage, !active && styles.mutedText]}>{item.stage}</Text>
                    <Text style={[styles.recordReading, !active && styles.mutedText]}>{item.reading}</Text>
                    <View style={styles.dateHistoryBox}>
                      {dates.map((d, idx) => <Text key={`${d}-${idx}`} style={[styles.recordDate, !active && styles.mutedText]}>완료 {idx + 1}: {d}</Text>)}
                      {!active && item.completion?.canceledAt ? <Text style={styles.cancelDate}>취소: {item.completion.canceledAt}</Text> : null}
                    </View>
                    <View style={styles.recordActions}>
                      {active ? (
                        <TouchableOpacity onPress={() => cancelCompletion(item.day)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>완료 취소</Text></TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => openDayReader(item.day, 'records')} style={styles.readAgainButton}><Text style={styles.readAgainButtonText}>본문 읽기</Text></TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.indexWrap}>
            <View style={styles.indexHeaderRow}>
              <View><Text style={styles.recordsTitle}>성경보기</Text><Text style={styles.recordsSubtitle}>책 · 장 · 절을 선택한 뒤 본문을 읽습니다.</Text></View>
              <TouchableOpacity onPress={cycleTranslation} style={styles.translationButton}><Text style={styles.translationText}>{selectedTranslation.name} ▼</Text></TouchableOpacity>
            </View>

            <Text style={styles.indexLabel}>1. 성경 책 선택</Text>
            <View style={styles.bookGrid}>
              {bibleBooks.map((book, idx) => {
                const name = book.koreanTitle || book.title || book.name || book.book;
                return (
                  <TouchableOpacity key={`${book.book || name}-${idx}`} onPress={() => { setSelectedBookIndex(idx); setSelectedChapter(1); setSelectedVerse(1); }} style={[styles.bookChip, selectedBookIndex === idx && styles.bookChipActive]}>
                    <Text style={[styles.bookChipText, selectedBookIndex === idx && styles.bookChipTextActive]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.indexLabel}>2. 장 선택</Text>
            <View style={styles.numberGrid}>
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity key={`c-${n}`} onPress={() => { setSelectedChapter(n); setSelectedVerse(1); }} style={[styles.numberChip, selectedChapter === n && styles.numberChipActive]}>
                  <Text style={[styles.numberChipText, selectedChapter === n && styles.numberChipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.indexLabel}>3. 절 선택</Text>
            <View style={styles.numberGrid}>
              {Array.from({ length: verseCount }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity key={`v-${n}`} onPress={() => setSelectedVerse(n)} style={[styles.numberChip, selectedVerse === n && styles.numberChipActive]}>
                  <Text style={[styles.numberChipText, selectedVerse === n && styles.numberChipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={openChapterReader} style={styles.completeButton}>
              <Text style={styles.completeButtonText}>본문 보기</Text>
            </TouchableOpacity>
            <Text style={styles.indexHint}>선택한 절 위치에서 열리며, 해당 장 전체를 위아래로 읽을 수 있습니다.</Text>
          </ScrollView>
        )}
      </View>

      <Modal visible={dayPickerOpen} transparent animationType="slide" onRequestClose={() => setDayPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>지나간 일정 선택</Text><Text style={styles.modalSubtitle}>Day 001부터 현재 Day까지 선택할 수 있습니다.</Text></View>
              <TouchableOpacity onPress={() => setDayPickerOpen(false)} style={styles.modalClose}><Text style={styles.modalCloseText}>닫기</Text></TouchableOpacity>
            </View>
            <FlatList
              data={schedule.slice(0, currentDay)}
              keyExtractor={(i) => String(i.day)}
              contentContainerStyle={styles.dayList}
              initialScrollIndex={Math.max(0, Math.min(currentDay - 1, schedule.slice(0, currentDay).length - 1))}
              getItemLayout={(_, index) => ({ length: 68, offset: 68 * index, index })}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => chooseDay(item.day)} style={[styles.dayPickerRow, item.day === displayDay && styles.dayPickerRowActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayPickerDay, item.day === displayDay && styles.dayPickerDayActive]}>{item.dayLabel}</Text>
                    <Text style={styles.dayPickerReading} numberOfLines={1}>{item.reading}</Text>
                  </View>
                  <Text style={styles.dayPickerState}>{completions[String(item.day)]?.active ? '✓' : ''}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F6F1' }, app: { flex: 1 }, loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: '800', color: '#9A7C43', marginBottom: 5 }, title: { fontSize: 22, lineHeight: 29, fontWeight: '900', color: '#17223B' },
  exitButton: { borderWidth: 1, borderColor: '#D6D2C8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#FFF' }, exitButtonText: { color: '#5B6471', fontWeight: '800', fontSize: 13 },
  tabs: { marginHorizontal: 22, flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: '#EAE8E1' }, tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' }, tabActive: { backgroundColor: '#FFF' }, tabText: { color: '#7A7F87', fontWeight: '800', fontSize: 13 }, tabTextActive: { color: '#17223B' },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 22 }, progressBlock: { marginBottom: 18 }, progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, progressLabel: { fontSize: 13, fontWeight: '800', color: '#626A75' }, progressValue: { fontSize: 13, fontWeight: '900', color: '#17223B' },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#E3E0D7', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#B28A48' },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#ECE8DE' }, dayBadge: { alignSelf: 'flex-start', backgroundColor: '#17223B', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 }, dayBadgeText: { color: '#FFF', fontWeight: '900' },
  pastNotice: { backgroundColor: '#EEF1F5', borderRadius: 12, padding: 11, marginBottom: 14 }, pastNoticeText: { fontSize: 11, color: '#5D6777', lineHeight: 17, fontWeight: '700' }, returnTodayText: { marginTop: 5, color: '#9A7C43', fontWeight: '900', fontSize: 12 },
  stage: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: '#9A7C43' }, divider: { height: 1, backgroundColor: '#EEEAE1', marginVertical: 18 }, readingLabel: { fontSize: 13, fontWeight: '800', color: '#747C86', marginBottom: 8 },
  readingButton: { borderRadius: 16, paddingVertical: 6 }, reading: { fontSize: 24, lineHeight: 35, fontWeight: '900', color: '#17223B', letterSpacing: -0.5 }, tapHint: { marginTop: 8, color: '#9A7C43', fontWeight: '900' },
  noteBox: { marginTop: 22, padding: 14, borderRadius: 14, backgroundColor: '#F6F1E7' }, noteText: { fontSize: 12, lineHeight: 18, color: '#6E675B', fontWeight: '600' },
  completeButton: { marginTop: 18, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#B28A48' }, completeButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  recordsWrap: { flex: 1, paddingTop: 22 }, recordsHeader: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }, recordsTitle: { fontSize: 21, fontWeight: '900', color: '#17223B' }, recordsSubtitle: { fontSize: 12, color: '#747C86', marginTop: 3, lineHeight: 17 }, countPill: { backgroundColor: '#F0E7D6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }, countPillText: { color: '#8B6B35', fontWeight: '900' },
  listContent: { paddingHorizontal: 22, paddingBottom: 28 }, recordCard: { backgroundColor: '#FFF', borderRadius: 17, padding: 16, marginBottom: 10 }, recordCardCanceled: { backgroundColor: '#F2F1ED' }, recordTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, recordDay: { fontSize: 14, fontWeight: '900', color: '#17223B' }, recordStatus: { fontSize: 11, fontWeight: '900', color: '#8B6B35' }, canceledStatus: { color: '#9A9A95' }, recordStage: { fontSize: 11, color: '#838993', marginBottom: 4 }, recordReading: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: '#303B52' }, recordDate: { fontSize: 11, lineHeight: 17, fontWeight: '700', color: '#9A7C43' }, mutedText: { color: '#A8AAA8' }, cancelDate: { marginTop: 3, fontSize: 11, color: '#A8AAA8', fontWeight: '700' }, dateHistoryBox: { marginTop: 9 }, recordActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }, cancelButton: { borderWidth: 1, borderColor: '#D8CFC2', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 }, cancelButtonText: { fontSize: 12, fontWeight: '900', color: '#7F6750' }, readAgainButton: { backgroundColor: '#17223B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, readAgainButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' }, emptyCard: { marginTop: 24, backgroundColor: '#FFF', borderRadius: 16, padding: 22, alignItems: 'center' }, emptyText: { color: '#777', fontWeight: '700' },
  bibleHeader: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E8E4DA', gap: 8 }, backButton: { paddingVertical: 8, paddingRight: 6 }, backText: { fontSize: 15, fontWeight: '900', color: '#9A7C43' }, bibleTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#17223B' }, homeButton: { backgroundColor: '#17223B', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, homeButtonText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  readerTools: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF' }, translationButton: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F5F1E8' }, translationText: { fontWeight: '900', color: '#17223B' }, fontTools: { flexDirection: 'row', gap: 8 }, fontButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#17223B' }, fontButtonText: { color: '#FFF', fontWeight: '900' },
  readerContent: { padding: 20, paddingBottom: 40 }, readerRange: { fontSize: 21, lineHeight: 31, fontWeight: '900', color: '#17223B', marginBottom: 20 }, section: { marginBottom: 18 }, chapterHeading: { fontSize: 19, fontWeight: '900', color: '#17223B', marginTop: 18, marginBottom: 8 }, verseText: { color: '#2E374A', marginBottom: 10 }, verseNumber: { fontWeight: '900', color: '#9A7C43' }, missingText: { color: '#A24A4A', fontWeight: '700' }, sourceBox: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#F0EEE7' }, sourceText: { fontSize: 11, lineHeight: 17, color: '#6B6F75' }, targetVerseWrap: { backgroundColor: '#F7F0DF', borderRadius: 8, paddingHorizontal: 4 },
  indexWrap: { padding: 22, paddingBottom: 45 }, indexHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, gap: 12 }, indexLabel: { fontSize: 15, fontWeight: '900', color: '#17223B', marginTop: 18, marginBottom: 10 }, bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, bookChip: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ECEAE4' }, bookChipActive: { backgroundColor: '#17223B' }, bookChipText: { color: '#5D6470', fontWeight: '800', fontSize: 12 }, bookChipTextActive: { color: '#FFF' }, numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, numberChip: { width: 43, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#ECEAE4' }, numberChipActive: { backgroundColor: '#B28A48' }, numberChipText: { fontWeight: '900', color: '#5D6470' }, numberChipTextActive: { color: '#FFF' }, indexHint: { marginTop: 10, textAlign: 'center', fontSize: 11, lineHeight: 17, color: '#777' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end' }, modalSheet: { height: '76%', backgroundColor: '#F7F6F1', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E5E1D8' }, modalTitle: { fontSize: 19, fontWeight: '900', color: '#17223B' }, modalSubtitle: { marginTop: 3, fontSize: 11, color: '#777' }, modalClose: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E9E5DC' }, modalCloseText: { fontWeight: '900', color: '#5E6570' }, dayList: { padding: 14, paddingBottom: 30 }, dayPickerRow: { height: 60, marginBottom: 8, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' }, dayPickerRowActive: { borderWidth: 2, borderColor: '#B28A48' }, dayPickerDay: { fontSize: 13, fontWeight: '900', color: '#17223B' }, dayPickerDayActive: { color: '#8B6B35' }, dayPickerReading: { marginTop: 3, fontSize: 11, color: '#777' }, dayPickerState: { width: 24, textAlign: 'center', color: '#B28A48', fontWeight: '900', fontSize: 17 },
});
