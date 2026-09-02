import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, BackHandler, FlatList, Modal, Platform, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import schedule from './assets/schedule.json';
import translations from './assets/bibles/translations.json';
import krv from './assets/bibles/krv.json';
import homologiaData from './assets/homologia.json';

const CURRENT_DAY_KEY = '@chronological_bible/current_day';
const COMPLETIONS_KEY = '@chronological_bible/completions';
const TRANSLATION_KEY = '@chronological_bible/translation';
const FONT_SIZE_KEY = '@chronological_bible/font_size';
const READER_POSITIONS_KEY = '@chronological_bible/reader_positions';
const VERSE_NOTES_KEY = '@chronological_bible/verse_notes';
const BIBLE_SELECTION_KEY = '@chronological_bible/bible_selection';
const HOMOLOGIA_FONT_SCALE_KEY = '@chronological_bible/homologia_font_scale';

const BIBLE_DATA = { KRV: krv };

const HOMOLOGIA_MENUS = [
  { title: '호물로기아 설명', color: '#0E5947', sectionIndex: 0 },
  { title: '율로기아', color: '#C61017', sectionIndex: 1 },
  { title: '지혜의 중보기도', color: '#171C4D', sectionIndex: 2 },
  { title: '치유기도', color: '#0E5947', sectionIndex: 3 },
  { title: '호물로기아 1', color: '#0E5947', sectionIndex: 4 },
  { title: '호물로기아 2', color: '#211F72', sectionIndex: 5 },
  { title: '호물로기아 3', color: '#705B08', sectionIndex: 6 },
  { title: '호물로기아 4', color: '#5B2C68', sectionIndex: 7 },
  { title: '이륙하기 버전', color: '#0E5947', sectionIndex: 8 },
];

const BOOK_NAME_KO = {
  Genesis: '창세기', Exodus: '출애굽기', Leviticus: '레위기', Numbers: '민수기', Deuteronomy: '신명기',
  Joshua: '여호수아', Judges: '사사기', Ruth: '룻기', '1 Samuel': '사무엘상', '2 Samuel': '사무엘하',
  '1 Kings': '열왕기상', '2 Kings': '열왕기하', '1 Chronicles': '역대상', '2 Chronicles': '역대하', Ezra: '에스라',
  Nehemiah: '느헤미야', Esther: '에스더', Job: '욥기', Psalms: '시편', Psalm: '시편', Proverbs: '잠언',
  Ecclesiastes: '전도서', 'Song of Solomon': '아가', 'Song of Songs': '아가', Isaiah: '이사야', Jeremiah: '예레미야',
  Lamentations: '예레미야애가', Ezekiel: '에스겔', Daniel: '다니엘', Hosea: '호세아', Joel: '요엘', Amos: '아모스',
  Obadiah: '오바댜', Jonah: '요나', Micah: '미가', Nahum: '나훔', Habakkuk: '하박국', Zephaniah: '스바냐',
  Haggai: '학개', Zechariah: '스가랴', Malachi: '말라기', Matthew: '마태복음', Mark: '마가복음', Luke: '누가복음',
  John: '요한복음', Acts: '사도행전', Romans: '로마서', '1 Corinthians': '고린도전서', '2 Corinthians': '고린도후서',
  Galatians: '갈라디아서', Ephesians: '에베소서', Philippians: '빌립보서', Colossians: '골로새서',
  '1 Thessalonians': '데살로니가전서', '2 Thessalonians': '데살로니가후서', '1 Timothy': '디모데전서', '2 Timothy': '디모데후서',
  Titus: '디도서', Philemon: '빌레몬서', Hebrews: '히브리서', James: '야고보서', '1 Peter': '베드로전서',
  '2 Peter': '베드로후서', '1 John': '요한일서', '2 John': '요한이서', '3 John': '요한삼서', Jude: '유다서', Revelation: '요한계시록',
};

const BIBLE_BOOKS = [
  ['Genesis','창세기','구약'], ['Exodus','출애굽기','구약'], ['Leviticus','레위기','구약'], ['Numbers','민수기','구약'], ['Deuteronomy','신명기','구약'],
  ['Joshua','여호수아','구약'], ['Judges','사사기','구약'], ['Ruth','룻기','구약'], ['1 Samuel','사무엘상','구약'], ['2 Samuel','사무엘하','구약'],
  ['1 Kings','열왕기상','구약'], ['2 Kings','열왕기하','구약'], ['1 Chronicles','역대상','구약'], ['2 Chronicles','역대하','구약'], ['Ezra','에스라','구약'],
  ['Nehemiah','느헤미야','구약'], ['Esther','에스더','구약'], ['Job','욥기','구약'], ['Psalms','시편','구약'], ['Proverbs','잠언','구약'],
  ['Ecclesiastes','전도서','구약'], ['Song of Solomon','아가','구약'], ['Isaiah','이사야','구약'], ['Jeremiah','예레미야','구약'], ['Lamentations','예레미야애가','구약'],
  ['Ezekiel','에스겔','구약'], ['Daniel','다니엘','구약'], ['Hosea','호세아','구약'], ['Joel','요엘','구약'], ['Amos','아모스','구약'],
  ['Obadiah','오바댜','구약'], ['Jonah','요나','구약'], ['Micah','미가','구약'], ['Nahum','나훔','구약'], ['Habakkuk','하박국','구약'],
  ['Zephaniah','스바냐','구약'], ['Haggai','학개','구약'], ['Zechariah','스가랴','구약'], ['Malachi','말라기','구약'],
  ['Matthew','마태복음','신약'], ['Mark','마가복음','신약'], ['Luke','누가복음','신약'], ['John','요한복음','신약'], ['Acts','사도행전','신약'],
  ['Romans','로마서','신약'], ['1 Corinthians','고린도전서','신약'], ['2 Corinthians','고린도후서','신약'], ['Galatians','갈라디아서','신약'], ['Ephesians','에베소서','신약'],
  ['Philippians','빌립보서','신약'], ['Colossians','골로새서','신약'], ['1 Thessalonians','데살로니가전서','신약'], ['2 Thessalonians','데살로니가후서','신약'],
  ['1 Timothy','디모데전서','신약'], ['2 Timothy','디모데후서','신약'], ['Titus','디도서','신약'], ['Philemon','빌레몬서','신약'], ['Hebrews','히브리서','신약'],
  ['James','야고보서','신약'], ['1 Peter','베드로전서','신약'], ['2 Peter','베드로후서','신약'], ['1 John','요한일서','신약'], ['2 John','요한이서','신약'],
  ['3 John','요한삼서','신약'], ['Jude','유다서','신약'], ['Revelation','요한계시록','신약'],
].map(([book, ko, testament], index) => ({ book, ko, testament, index }));

function getKoreanBookName(book) {
  if (!book) return '';
  const direct = book.koreanTitle || (BOOK_NAME_KO[book.title] ? null : book.title);
  if (direct && /[가-힣]/.test(direct)) return direct;
  const raw = book.book || book.name || book.title || '';
  return BOOK_NAME_KO[raw] || book.koreanTitle || book.title || book.name || book.book || '';
}

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

function safeParseJson(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
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
  const [testament, setTestament] = useState('구약');
  const [selectedBookKey, setSelectedBookKey] = useState('Genesis');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVerse, setSelectedVerse] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [verseNotes, setVerseNotes] = useState({});
  const [noteModal, setNoteModal] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [completionModal, setCompletionModal] = useState(null);
  const [homologiaSectionIndex, setHomologiaSectionIndex] = useState(null);
  const [homologiaFontScale, setHomologiaFontScale] = useState(1);

  const readerRef = useRef(null);
  const recordsRef = useRef(null);
  const lastScrollY = useRef(0);
  const pendingTargetY = useRef(null);
  const restoredKey = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await AsyncStorage.multiGet([
          CURRENT_DAY_KEY, COMPLETIONS_KEY, TRANSLATION_KEY, FONT_SIZE_KEY, READER_POSITIONS_KEY, VERSE_NOTES_KEY, BIBLE_SELECTION_KEY, HOMOLOGIA_FONT_SCALE_KEY,
        ]);
        const saved = Object.fromEntries(rows);
        const d = Number(saved[CURRENT_DAY_KEY] || 1);
        const safeDay = Number.isFinite(d) && d >= 1 && d <= 365 ? d : 1;
        setCurrentDay(safeDay);
        setDisplayDay(safeDay);
        const migrated = migrateCompletions(safeParseJson(saved[COMPLETIONS_KEY], {}));
        setCompletions(migrated);
        setTranslationId(saved[TRANSLATION_KEY] || 'KRV');
        const f = Number(saved[FONT_SIZE_KEY] || 19);
        setFontSize(Number.isFinite(f) ? Math.min(30, Math.max(15, f)) : 19);
        setReaderPositions(safeParseJson(saved[READER_POSITIONS_KEY], {}));
        setVerseNotes(safeParseJson(saved[VERSE_NOTES_KEY], {}));
        const homologiaScale = Number(saved[HOMOLOGIA_FONT_SCALE_KEY] || 1);
        setHomologiaFontScale(Number.isFinite(homologiaScale) ? Math.min(1.45, Math.max(0.75, homologiaScale)) : 1);
        const bibleSelection = safeParseJson(saved[BIBLE_SELECTION_KEY], null);
        if (bibleSelection) {
          if (bibleSelection.testament) setTestament(bibleSelection.testament);
          if (bibleSelection.book) setSelectedBookKey(bibleSelection.book);
          if (Number(bibleSelection.chapter) > 0) setSelectedChapter(Number(bibleSelection.chapter));
          if (Number(bibleSelection.verse) > 0) setSelectedVerse(Number(bibleSelection.verse));
        }
      } catch (error) {
        // 저장 데이터 일부가 손상되어도 앱 자체는 실행되도록 기본값으로 복구합니다.
        console.warn('Saved data load failed:', error);
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
      .sort((a, b) => a.day - b.day)
  ), [completions]);

  const bibleBooks = useMemo(() => normalizeBooks(BIBLE_DATA[translationId]), [translationId]);
  const canonicalBooks = useMemo(() => BIBLE_BOOKS.map((meta) => ({
    ...meta,
    data: getBook(BIBLE_DATA[translationId], meta.book, meta.ko),
  })).filter((x) => x.data), [translationId]);
  const testamentBooks = canonicalBooks.filter((x) => x.testament === testament);
  const selectedBookMeta = canonicalBooks.find((x) => x.book === selectedBookKey) || canonicalBooks[0];
  const selectedBook = selectedBookMeta?.data;
  const chapterCount = selectedBook?.chapters?.length || 1;
  const selectedChapterData = (selectedBook?.chapters || []).find((c) => Number(c.chapter) === selectedChapter) || selectedBook?.chapters?.[0];
  const verseCount = selectedChapterData?.verses?.length || 1;

  useEffect(() => {
    if (selectedChapter > chapterCount) setSelectedChapter(1);
  }, [selectedBookKey, chapterCount, selectedChapter]);

  useEffect(() => {
    if (selectedVerse > verseCount) setSelectedVerse(1);
  }, [selectedChapter, verseCount, selectedVerse]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(BIBLE_SELECTION_KEY, JSON.stringify({
      testament,
      book: selectedBookKey,
      chapter: selectedChapter,
      verse: selectedVerse,
    })).catch((error) => console.warn('Bible selection save failed:', error));
  }, [loaded, testament, selectedBookKey, selectedChapter, selectedVerse]);

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
    setSelectedVerses([]);
    setReaderReturnScreen(returnTo);
    setReaderContext({ type: 'day', day });
    restoredKey.current = null;
    pendingTargetY.current = null;
    setScreen('reader');
  };

  const openChapterReader = () => {
    setSelectedVerses([]);
    if (!selectedBook) return;
    const bookKo = selectedBookMeta?.ko || getKoreanBookName(selectedBook);
    setReaderReturnScreen('bibleIndex');
    setReaderContext({
      type: 'chapter',
      book: selectedBookMeta?.book || selectedBook.book || selectedBook.name,
      bookKo,
      chapter: selectedChapter,
      verse: selectedVerse,
    });
    restoredKey.current = null;
    pendingTargetY.current = null;
    setScreen('reader');
  };

  const moveChapter = async (direction) => {
    if (readerContext?.type !== 'chapter') return;
    const currentBookIndex = canonicalBooks.findIndex((x) => x.book === readerContext.book);
    if (currentBookIndex < 0) return;

    let targetBookIndex = currentBookIndex;
    let targetChapter = readerContext.chapter + direction;
    const currentChapterCount = canonicalBooks[currentBookIndex]?.data?.chapters?.length || 1;

    if (targetChapter < 1) {
      targetBookIndex -= 1;
      if (targetBookIndex < 0) {
        Alert.alert('성경 처음', '창세기 1장입니다.');
        return;
      }
      targetChapter = canonicalBooks[targetBookIndex]?.data?.chapters?.length || 1;
    } else if (targetChapter > currentChapterCount) {
      targetBookIndex += 1;
      if (targetBookIndex >= canonicalBooks.length) {
        Alert.alert('성경 마지막', '요한계시록 마지막 장입니다.');
        return;
      }
      targetChapter = 1;
    }

    await saveCurrentPosition();
    const target = canonicalBooks[targetBookIndex];
    setSelectedVerses([]);
    setSelectedBookKey(target.book);
    setTestament(target.testament);
    setSelectedChapter(targetChapter);
    setSelectedVerse(1);
    setReaderContext({
      type: 'chapter',
      book: target.book,
      bookKo: target.ko,
      chapter: targetChapter,
      verse: 1,
    });
    restoredKey.current = null;
    pendingTargetY.current = 0;
    lastScrollY.current = 0;
    setTimeout(() => readerRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const closeReader = async (destination = readerReturnScreen) => {
    setSelectedVerses([]);
    await saveCurrentPosition();
    setScreen(destination);
  };

  useEffect(() => {
    if (Platform.OS !== 'android' || !['reader', 'homologiaReader'].includes(screen)) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'homologiaReader') setScreen('homologia');
      else closeReader(readerContext?.type === 'chapter' ? 'bibleIndex' : 'today');
      return true;
    });
    return () => subscription.remove();
  }, [screen, readerKey, readerPositions, readerContext?.type]);

  const completeDay = async (day, advanceIfCurrent = false, destination = 'today') => {
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

    if (screen === 'reader') {
      await saveCurrentPosition();
      setScreen('today');
    }
    await AsyncStorage.multiSet([
      [COMPLETIONS_KEY, JSON.stringify(next)],
      [CURRENT_DAY_KEY, String(nextDay)],
    ]);
    setCompletions(next);
    setCurrentDay(nextDay);

    const item = schedule[day - 1];
    setCompletionModal({
      item,
      nextDay,
      advanceIfCurrent: advanceIfCurrent && day === currentDay,
      destination,
      finalDay: day === schedule.length && advanceIfCurrent,
    });
  };

  const closeCompletionModal = () => {
    const info = completionModal;
    setCompletionModal(null);
    if (!info) return;
    if (info.advanceIfCurrent) {
      if (info.item?.day < schedule.length) setDisplayDay(info.nextDay);
      setScreen('today');
      return;
    }
    setScreen(info.destination === 'records' ? 'records' : 'today');
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
            const remainingDates = (existing.dates || []).slice(0, -1);
            const next = {
              ...completions,
              [key]: {
                ...existing,
                dates: remainingDates,
                active: remainingDates.length > 0,
                canceledAt: formatKoreanDateTime(),
              },
            };
            await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(next));
            setCompletions(next);
          },
        },
      ],
    );
  };

  const verseKey = (v) => `${translationId}:${v.bookKo}:${v.chapter}:${v.verse}`;

  const toggleVerseSelection = (v) => {
    const key = verseKey(v);
    setSelectedVerses((prev) => prev.some((x) => x.key === key)
      ? prev.filter((x) => x.key !== key)
      : [...prev, { ...v, key }]);
  };

  const copySelectedVerses = async () => {
    if (!selectedVerses.length) return;
    const translationName = selectedTranslation?.name || selectedTranslation?.label || translationId;
    const text = selectedVerses
      .map((v) => `${v.text} (${v.bookKo} ${v.chapter}:${v.verse}, ${translationName})`)
      .join('\n');
    try {
      // 앱 시작 시 Clipboard 모듈을 즉시 불러오지 않고, 실제 복사할 때만 불러옵니다.
      // 이렇게 하면 복사 기능에 문제가 생겨도 앱 전체가 실행되지 않는 일을 막을 수 있습니다.
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(text);
      Alert.alert('복사 완료', `${selectedVerses.length}개 절을 복사했습니다.`);
    } catch (error) {
      Alert.alert('복사 오류', '복사 기능을 불러오지 못했습니다. 앱을 다시 설치한 뒤 한 번 더 시도해 주세요.');
    }
  };

  const openNoteForVerse = (v) => {
    const key = verseKey(v);
    setNoteDraft(verseNotes[key] || '');
    setNoteModal({ keys: [key], label: `${v.bookKo} ${v.chapter}:${v.verse}` });
  };

  const openNoteForSelection = () => {
    if (!selectedVerses.length) return;
    const keys = selectedVerses.map((v) => v.key);
    const existing = keys.map((k) => verseNotes[k]).find(Boolean) || '';
    const first = selectedVerses[0];
    const last = selectedVerses[selectedVerses.length - 1];
    setNoteDraft(existing);
    setNoteModal({ keys, label: selectedVerses.length === 1 ? `${first.bookKo} ${first.chapter}:${first.verse}` : `${first.bookKo} ${first.chapter}:${first.verse} ~ ${last.chapter}:${last.verse}` });
  };

  const saveNote = async () => {
    if (!noteModal) return;
    const next = { ...verseNotes };
    noteModal.keys.forEach((key) => {
      if (noteDraft.trim()) next[key] = noteDraft.trim();
      else delete next[key];
    });
    setVerseNotes(next);
    await AsyncStorage.setItem(VERSE_NOTES_KEY, JSON.stringify(next));
    setNoteModal(null);
    setNoteDraft('');
  };

  const deleteNote = async () => {
    if (!noteModal) return;
    const next = { ...verseNotes };
    noteModal.keys.forEach((key) => delete next[key]);
    setVerseNotes(next);
    await AsyncStorage.setItem(VERSE_NOTES_KEY, JSON.stringify(next));
    setNoteModal(null);
    setNoteDraft('');
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

  if (screen === 'homologiaReader' && homologiaSectionIndex !== null) {
    const section = homologiaData.sections[homologiaSectionIndex];
    const sourceBlocks = homologiaData.pages
      .filter((page) => page.page >= section.startPage && page.page <= section.endPage)
      .flatMap((page) => page.blocks.map((block, blockIndex) => ({
        ...block,
        spans: block.spans.filter((span, spanIndex) => !(
          blockIndex === 0
          && spanIndex === 0
          && Number(span.size) <= 12
          && span.text.trim() === String(page.page)
        )),
      })))
      .filter((block) => {
        const text = block.spans.map((span) => span.text).join('').trim();
        return text && !text.includes('책 처음으로 이동');
      });

    const blockText = (block) => block.spans.map((span) => span.text).join('').trim();
    const sectionBlocks = sourceBlocks.reduce((flow, block) => {
      const previous = flow[flow.length - 1];
      const previousText = previous ? blockText(previous) : '';
      const currentText = blockText(block);
      const previousIsBody = previous && !previous.background && previous.align === 'left' && (previous.baseSize || 28) <= 28.5;
      const currentIsBody = !block.background && block.align === 'left' && (block.baseSize || 28) <= 28.5;
      const sentenceContinues = previousText && !/[.!?。！？…]["'”’）)\]]*$/.test(previousText);
      const similarSize = previous && Math.abs((previous.baseSize || 28) - (block.baseSize || 28)) <= 2;

      if (previousIsBody && currentIsBody && sentenceContinues && similarSize) {
        const joinStyle = block.spans[0] || previous.spans[previous.spans.length - 1];
        previous.spans = [
          ...previous.spans,
          { ...joinStyle, text: ' ' },
          ...block.spans,
        ];
        return flow;
      }
      flow.push({ ...block, spans: [...block.spans], paragraphBreak: flow.length > 0 });
      return flow;
    }, []);

    const changeHomologiaFont = (delta) => setHomologiaFontScale((value) => {
      const next = Math.min(1.45, Math.max(0.75, Number((value + delta).toFixed(2))));
      AsyncStorage.setItem(HOMOLOGIA_FONT_SCALE_KEY, String(next))
        .catch((error) => console.warn('Homologia font size save failed:', error));
      return next;
    });

    const formatSentenceText = (spans, spanIndex) => {
      const text = spans[spanIndex]?.text || '';
      const formatted = text
        .replace(/([.!?。！？…]+["'”’）)\]]*)[ \t]+/g, '$1\n')
        .replace(/\n{3,}/g, '\n\n');
      const hasFollowingText = spans.slice(spanIndex + 1).some((span) => span.text.trim());
      if (hasFollowingText && /[.!?。！？…]+["'”’）)\]]*[ \t]*$/.test(formatted) && !formatted.endsWith('\n')) {
        return `${formatted.trimEnd()}\n`;
      }
      return formatted;
    };

    return (
      <SafeAreaView style={styles.homologiaReaderSafe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.homologiaReaderHeader}>
          <TouchableOpacity onPress={() => setScreen('homologia')} style={styles.homologiaBackButton}>
            <Text style={styles.homologiaBackText}>‹ 목록</Text>
          </TouchableOpacity>
          <View style={styles.homologiaReaderHeading}>
            <Text style={styles.homologiaReaderTitle}>{HOMOLOGIA_MENUS[homologiaSectionIndex]?.title}</Text>
            <Text style={styles.homologiaPageRange}>원본 구성 · 글자 보기</Text>
          </View>
          <View style={styles.homologiaFontTools}>
            <TouchableOpacity onPress={() => changeHomologiaFont(-0.1)} style={styles.homologiaFontButton}><Text style={styles.homologiaFontButtonText}>A−</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => changeHomologiaFont(0.1)} style={styles.homologiaFontButton}><Text style={styles.homologiaFontButtonText}>A+</Text></TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={sectionBlocks}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.homologiaPages}
          initialNumToRender={12}
          windowSize={7}
          renderItem={({ item: block }) => {
            const baseFontSize = Math.round(Math.max(12, Math.min(30, (block.baseSize || 28) * 0.62)) * homologiaFontScale);
            const blockLineHeight = Math.round(baseFontSize * 1.62);
            return (
              <View
                style={[
                  styles.homologiaTextBlock,
                  {
                    marginTop: block.paragraphBreak ? Math.max(block.gap || 5, Math.round(baseFontSize * 0.8)) : (block.gap || 5),
                    paddingLeft: block.indent || 0,
                  },
                  block.background && { backgroundColor: block.background, paddingVertical: 10, paddingHorizontal: 10 },
                ]}
              >
                <Text style={{ textAlign: block.align || 'left', fontSize: baseFontSize, lineHeight: blockLineHeight }}>
                  {block.spans.map((span, spanIndex) => (
                    <Text
                      key={spanIndex}
                      style={{
                        color: span.color || '#67530E',
                        fontSize: Math.round(Math.max(12, Math.min(30, (span.size || block.baseSize || 28) * 0.62)) * homologiaFontScale),
                        fontWeight: span.bold ? '900' : '600',
                        fontStyle: span.italic ? 'italic' : 'normal',
                      }}
                    >{formatSentenceText(block.spans, spanIndex)}</Text>
                  ))}
                </Text>
              </View>
            );
          }}
        />
      </SafeAreaView>
    );
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
        {selectedVerses.length > 0 && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionCount}>{selectedVerses.length}절 선택</Text>
            <TouchableOpacity onPress={copySelectedVerses} style={styles.selectionAction}><Text style={styles.selectionActionText}>복사</Text></TouchableOpacity>
            <TouchableOpacity onPress={openNoteForSelection} style={styles.selectionAction}><Text style={styles.selectionActionText}>메모</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedVerses([])} style={styles.selectionClear}><Text style={styles.selectionClearText}>해제</Text></TouchableOpacity>
          </View>
        )}
        {readerContext.type === 'chapter' && (
          <View style={styles.fixedChapterHeader}>
            <Text style={styles.fixedChapterHeaderText}>{readerContext.bookKo} {readerContext.chapter}장</Text>
          </View>
        )}
        <ScrollView
          ref={readerRef}
          contentContainerStyle={styles.readerContent}
          onContentSizeChange={handleContentReady}
          onScroll={(e) => { lastScrollY.current = e.nativeEvent.contentOffset.y; }}
          onScrollEndDrag={saveCurrentPosition}
          onMomentumScrollEnd={saveCurrentPosition}
          scrollEventThrottle={80}
        >
          {readerContext.type === 'day' && <Text style={styles.readerRange}>{readerRange}</Text>}
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
                    style={[isTargetVerse && styles.targetVerseWrap, selectedVerses.some((x) => x.key === verseKey(v)) && styles.selectedVerseWrap]}
                  >
                    {showChapter && readerContext.type === 'day' && <Text style={styles.chapterHeading}>{v.bookKo} {v.chapter}장</Text>}
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onLongPress={() => toggleVerseSelection(v)}
                      onPress={() => { if (selectedVerses.length) toggleVerseSelection(v); }}
                      delayLongPress={450}
                    >
                      <Text style={[styles.verseText, { fontSize, lineHeight: Math.round(fontSize * 1.7) }]}>
                        <Text style={styles.verseNumber}>{v.verse} </Text>{v.text}
                        {verseNotes[verseKey(v)] ? <Text onPress={() => openNoteForVerse(v)} style={styles.noteMark}>  📝</Text> : null}
                      </Text>
                    </TouchableOpacity>
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
              onPress={() => completeDay(dayItem.day, isCurrentReaderDay, readerReturnScreen)}
              style={styles.completeButton}
            >
              <Text style={styles.completeButtonText}>
                {isCurrentReaderDay ? '✓ 오늘 통독 완료' : dayCompletion?.active ? '✓ 완료 날짜 추가' : '✓ 이 일정 완료'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {readerContext.type === 'chapter' && (
          <View style={styles.chapterNavigation}>
            <TouchableOpacity onPress={() => moveChapter(-1)} style={styles.chapterNavButton}>
              <Text style={styles.chapterNavButtonText}>‹ 이전 장</Text>
            </TouchableOpacity>
            <Text style={styles.chapterNavCurrent}>{readerContext.bookKo} {readerContext.chapter}장</Text>
            <TouchableOpacity onPress={() => moveChapter(1)} style={styles.chapterNavButton}>
              <Text style={styles.chapterNavButtonText}>다음 장 ›</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={!!noteModal} transparent animationType="fade" onRequestClose={() => setNoteModal(null)}>
          <View style={styles.noteModalBackdrop}>
            <View style={styles.postIt}>
              <Text style={styles.postItTitle}>📝 말씀 메모</Text>
              <Text style={styles.postItVerse}>{noteModal?.label}</Text>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                multiline
                autoFocus
                placeholder="이 말씀에 대한 생각이나 묵상을 적어 주세요."
                placeholderTextColor="#9B8D62"
                style={styles.noteInput}
              />
              <View style={styles.noteButtons}>
                {noteModal?.keys?.some((k) => verseNotes[k]) ? <TouchableOpacity onPress={deleteNote} style={styles.noteDelete}><Text style={styles.noteDeleteText}>삭제</Text></TouchableOpacity> : <View />}
                <View style={styles.noteRightButtons}>
                  <TouchableOpacity onPress={() => setNoteModal(null)} style={styles.noteCancel}><Text style={styles.noteCancelText}>취소</Text></TouchableOpacity>
                  <TouchableOpacity onPress={saveNote} style={styles.noteSave}><Text style={styles.noteSaveText}>저장</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
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
          <TouchableOpacity onPress={() => setScreen('notice')} style={[styles.tab, screen === 'notice' && styles.tabActive]}><Text style={[styles.tabText, screen === 'notice' && styles.tabTextActive]}>공지사항</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('homologia')} style={[styles.tab, screen === 'homologia' && styles.tabActive]}><Text style={[styles.tabText, screen === 'homologia' && styles.tabTextActive]}>GF호물로기아</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('bibleIndex')} style={[styles.tab, screen === 'bibleIndex' && styles.tabActive]}><Text style={[styles.tabText, screen === 'bibleIndex' && styles.tabTextActive]}>성경보기</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setDisplayDay(currentDay); setScreen('today'); }} style={[styles.tab, screen === 'today' && styles.tabActive]}><Text style={[styles.tabText, screen === 'today' && styles.tabTextActive]}>오늘 일정</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('records')} style={[styles.tab, screen === 'records' && styles.tabActive]}><Text style={[styles.tabText, screen === 'records' && styles.tabTextActive]}>완료기록</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('settings')} style={[styles.tab, screen === 'settings' && styles.tabActive]}><Text style={[styles.tabText, screen === 'settings' && styles.tabTextActive]}>설정</Text></TouchableOpacity>
        </View>

        {screen === 'notice' ? (
          <View style={styles.placeholderScreen}>
            <Text style={styles.placeholderTitle}>공지사항</Text>
            <Text style={styles.placeholderText}>공지사항 메뉴는 앞으로 추가될 예정입니다.</Text>
          </View>
        ) : screen === 'homologia' ? (
          <ScrollView contentContainerStyle={styles.homologiaScreen} showsVerticalScrollIndicator={false}>
            <Text style={styles.homologiaTitle}>GF호물로기아</Text>
            <Text style={styles.homologiaSubtitle}>원하는 메뉴를 선택해 주세요.</Text>
            <View style={styles.homologiaGrid}>
              {HOMOLOGIA_MENUS.map((menu) => (
                <TouchableOpacity
                  key={menu.title}
                  onPress={() => { setHomologiaSectionIndex(menu.sectionIndex); setScreen('homologiaReader'); }}
                  style={[styles.homologiaButton, { backgroundColor: menu.color }]}
                >
                  <Text style={styles.homologiaButtonText}>{menu.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : screen === 'settings' ? (
          <View style={styles.placeholderScreen}>
            <Text style={styles.placeholderTitle}>설정</Text>
            <Text style={styles.placeholderText}>설정 메뉴는 앞으로 추가될 예정입니다.</Text>
          </View>
        ) : screen === 'today' && displayed ? (
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
                <Text style={styles.noteText}>Day 번호를 누르면 원하는 일정을 불러올 수 있습니다. 다른 일정을 완료해도 오늘 일정은 뒤로 돌아가지 않습니다.</Text>
              </View>
              <TouchableOpacity onPress={() => completeDay(displayDay, displayDay === currentDay, 'today')} style={styles.completeButton}>
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
              inverted
              data={[...completedRows].reverse()}
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
          <View style={styles.indexWrapFlex}>
            <View style={styles.indexHeaderRow}>
              <View><Text style={styles.recordsTitle}>성경보기</Text><Text style={styles.recordsSubtitle}>구약/신약 · 성경책 · 장 · 절을 선택합니다.</Text></View>
              <TouchableOpacity onPress={cycleTranslation} style={styles.translationButton}><Text style={styles.translationText}>{selectedTranslation.name} ▼</Text></TouchableOpacity>
            </View>

            <View style={styles.testamentTabs}>
              {['구약','신약'].map((t) => <TouchableOpacity key={t} onPress={() => {
                setTestament(t);
                const first = canonicalBooks.find((x) => x.testament === t);
                if (first) { setSelectedBookKey(first.book); setSelectedChapter(1); setSelectedVerse(1); }
              }} style={[styles.testamentTab, testament === t && styles.testamentTabActive]}><Text style={[styles.testamentText, testament === t && styles.testamentTextActive]}>{t}</Text></TouchableOpacity>)}
            </View>

            <View style={styles.bibleSelectorColumns}>
              <View style={[styles.selectorColumn, styles.bookColumn]}>
                <Text style={styles.selectorTitle}>성경책</Text>
                <ScrollView>
                  {testamentBooks.map((meta) => <TouchableOpacity key={meta.book} onPress={() => { setSelectedBookKey(meta.book); setSelectedChapter(1); setSelectedVerse(1); }} style={[styles.selectorRow, selectedBookKey === meta.book && styles.selectorRowActive]}><Text style={[styles.selectorRowText, selectedBookKey === meta.book && styles.selectorRowTextActive]}>{meta.ko}</Text></TouchableOpacity>)}
                </ScrollView>
              </View>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorTitle}>장</Text>
                <ScrollView>
                  {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => <TouchableOpacity key={n} onPress={() => { setSelectedChapter(n); setSelectedVerse(1); }} style={[styles.selectorRow, selectedChapter === n && styles.selectorRowActive]}><Text style={[styles.selectorRowText, selectedChapter === n && styles.selectorRowTextActive]}>{n}</Text></TouchableOpacity>)}
                </ScrollView>
              </View>
              <View style={styles.selectorColumn}>
                <Text style={styles.selectorTitle}>절</Text>
                <ScrollView>
                  {Array.from({ length: verseCount }, (_, i) => i + 1).map((n) => <TouchableOpacity key={n} onPress={() => setSelectedVerse(n)} style={[styles.selectorRow, selectedVerse === n && styles.selectorRowActive]}><Text style={[styles.selectorRowText, selectedVerse === n && styles.selectorRowTextActive]}>{n}</Text></TouchableOpacity>)}
                </ScrollView>
              </View>
            </View>
            <TouchableOpacity onPress={openChapterReader} style={[styles.completeButton, styles.indexOpenButton]}><Text style={styles.completeButtonText}>본문 보기</Text></TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={!!completionModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.celebrateBackdrop}>
          <View style={styles.celebrateCard}>
            <Text style={styles.confetti}>🎉 ✨ 🎊</Text>
            <Text style={styles.celebrateTitle}>축하합니다 🎉</Text>
            <View style={styles.celebrateSummary}>
              <Text style={styles.celebrateSmall}>오늘 읽은 내용</Text>
              <View style={styles.celebrateDayBadge}><Text style={styles.celebrateDayText}>{completionModal?.item?.dayLabel}</Text></View>
              <Text style={styles.celebrateStage}>{completionModal?.item?.stage}</Text>
              <View style={styles.celebrateDivider} />
              <Text style={styles.celebrateSmall}>오늘 읽을 말씀</Text>
              <Text style={styles.celebrateReading}>{completionModal?.item?.reading}</Text>
            </View>
            <Text style={styles.celebrateSuccess}>성경읽기에 성공하셨습니다.!!!</Text>
            {completionModal?.finalDay ? <Text style={styles.finalCongrats}>365일 연대기별 성경통독 일정을 모두 완료했습니다!</Text> : null}
            <TouchableOpacity onPress={closeCompletionModal} style={styles.celebrateButton}><Text style={styles.celebrateButtonText}>확인</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!noteModal} transparent animationType="fade" onRequestClose={() => setNoteModal(null)}>
        <View style={styles.noteModalBackdrop}>
          <View style={styles.postIt}>
            <Text style={styles.postItTitle}>📝 말씀 메모</Text>
            <Text style={styles.postItVerse}>{noteModal?.label}</Text>
            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              autoFocus
              placeholder="이 말씀에 대한 생각이나 묵상을 적어 주세요."
              placeholderTextColor="#9B8D62"
              style={styles.noteInput}
            />
            <View style={styles.noteButtons}>
              {noteModal?.keys?.some((k) => verseNotes[k]) ? <TouchableOpacity onPress={deleteNote} style={styles.noteDelete}><Text style={styles.noteDeleteText}>삭제</Text></TouchableOpacity> : <View />}
              <View style={styles.noteRightButtons}>
                <TouchableOpacity onPress={() => setNoteModal(null)} style={styles.noteCancel}><Text style={styles.noteCancelText}>취소</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveNote} style={styles.noteSave}><Text style={styles.noteSaveText}>저장</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dayPickerOpen} transparent animationType="slide" onRequestClose={() => setDayPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>일정 선택</Text><Text style={styles.modalSubtitle}>Day 001부터 Day 365까지 선택할 수 있습니다. 오늘 일정은 그대로 유지됩니다.</Text></View>
              <TouchableOpacity onPress={() => setDayPickerOpen(false)} style={styles.modalClose}><Text style={styles.modalCloseText}>닫기</Text></TouchableOpacity>
            </View>
            <FlatList
              data={schedule}
              keyExtractor={(i) => String(i.day)}
              contentContainerStyle={styles.dayList}
              initialScrollIndex={Math.max(0, Math.min(currentDay - 1, schedule.length - 1))}
              getItemLayout={(_, index) => ({ length: 68, offset: 68 * index, index })}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => chooseDay(item.day)} style={[styles.dayPickerRow, completions[String(item.day)]?.active && styles.dayPickerRowCompleted, item.day === displayDay && styles.dayPickerRowActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayPickerDay, completions[String(item.day)]?.active && styles.dayPickerTextCompleted, item.day === displayDay && styles.dayPickerDayActive]}>{item.dayLabel}</Text>
                    <Text style={[styles.dayPickerReading, completions[String(item.day)]?.active && styles.dayPickerTextCompleted]} numberOfLines={1}>{item.reading}</Text>
                  </View>
                  <Text style={styles.dayPickerState}>{completions[String(item.day)]?.active ? '✓ 완료' : ''}</Text>
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
  tabs: { marginHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 14, backgroundColor: '#EAE8E1' },
  tab: { width: '33.333%', paddingHorizontal: 5, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { color: '#7A7F87', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  tabTextActive: { color: '#17223B' },
  placeholderScreen: { flex: 1, alignSelf: 'stretch', margin: 22, padding: 24, borderRadius: 22, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  placeholderTitle: { width: '100%', textAlign: 'center', fontSize: 25, fontWeight: '900', color: '#17223B' },
  placeholderText: { width: '100%', marginTop: 10, fontSize: 14, lineHeight: 21, color: '#747C86', textAlign: 'center' },
  homologiaScreen: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 80 },
  homologiaTitle: { fontSize: 26, fontWeight: '900', color: '#17223B' },
  homologiaSubtitle: { marginTop: 6, marginBottom: 22, fontSize: 13, color: '#747C86' },
  homologiaGrid: { width: '100%', alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  homologiaButton: { width: '48.5%', minHeight: 68, paddingHorizontal: 10, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  homologiaButtonText: { color: '#FFF', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 22 }, progressBlock: { marginBottom: 18 }, progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, progressLabel: { fontSize: 13, fontWeight: '800', color: '#626A75' }, progressValue: { fontSize: 13, fontWeight: '900', color: '#17223B' },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#E3E0D7', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#B28A48' },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#ECE8DE' }, dayBadge: { alignSelf: 'flex-start', backgroundColor: '#17223B', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 }, dayBadgeText: { color: '#FFF', fontWeight: '900' },
  pastNotice: { backgroundColor: '#EEF1F5', borderRadius: 12, padding: 11, marginBottom: 14 }, pastNoticeText: { fontSize: 11, color: '#5D6777', lineHeight: 17, fontWeight: '700' }, returnTodayText: { marginTop: 5, color: '#9A7C43', fontWeight: '900', fontSize: 12 },
  stage: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: '#9A7C43' }, divider: { height: 1, backgroundColor: '#EEEAE1', marginVertical: 18 }, readingLabel: { fontSize: 13, fontWeight: '800', color: '#747C86', marginBottom: 8 },
  readingButton: { borderRadius: 16, paddingVertical: 6 }, reading: { fontSize: 24, lineHeight: 35, fontWeight: '900', color: '#17223B', letterSpacing: -0.5 }, tapHint: { marginTop: 8, color: '#9A7C43', fontWeight: '900' },
  noteBox: { marginTop: 22, padding: 14, borderRadius: 14, backgroundColor: '#F6F1E7' }, noteText: { fontSize: 12, lineHeight: 18, color: '#6E675B', fontWeight: '600' },
  completeButton: { marginTop: 18, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#B28A48' }, completeButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  recordsWrap: { flex: 1, paddingTop: 22 }, recordsHeader: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }, recordsTitle: { fontSize: 21, fontWeight: '900', color: '#17223B' }, recordsSubtitle: { fontSize: 12, color: '#747C86', marginTop: 3, lineHeight: 17 }, countPill: { backgroundColor: '#F0E7D6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 }, countPillText: { color: '#8B6B35', fontWeight: '900' },
  listContent: { paddingHorizontal: 22, paddingBottom: 120 }, recordCard: { backgroundColor: '#FFF', borderRadius: 17, padding: 16, marginBottom: 10 }, recordCardCanceled: { backgroundColor: '#F2F1ED' }, recordTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, recordDay: { fontSize: 14, fontWeight: '900', color: '#17223B' }, recordStatus: { fontSize: 11, fontWeight: '900', color: '#8B6B35' }, canceledStatus: { color: '#9A9A95' }, recordStage: { fontSize: 11, color: '#838993', marginBottom: 4 }, recordReading: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: '#303B52' }, recordDate: { fontSize: 11, lineHeight: 17, fontWeight: '700', color: '#9A7C43' }, mutedText: { color: '#A8AAA8' }, cancelDate: { marginTop: 3, fontSize: 11, color: '#A8AAA8', fontWeight: '700' }, dateHistoryBox: { marginTop: 9 }, recordActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }, cancelButton: { borderWidth: 1, borderColor: '#D8CFC2', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 }, cancelButtonText: { fontSize: 12, fontWeight: '900', color: '#7F6750' }, readAgainButton: { backgroundColor: '#17223B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, readAgainButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' }, emptyCard: { marginTop: 24, backgroundColor: '#FFF', borderRadius: 16, padding: 22, alignItems: 'center' }, emptyText: { color: '#777', fontWeight: '700' },
  bibleHeader: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E8E4DA', gap: 8 }, backButton: { paddingVertical: 8, paddingRight: 6 }, backText: { fontSize: 15, fontWeight: '900', color: '#9A7C43' }, bibleTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#17223B' }, homeButton: { backgroundColor: '#17223B', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, homeButtonText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  readerTools: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF' }, translationButton: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F5F1E8' }, translationText: { fontWeight: '900', color: '#17223B' }, fontTools: { flexDirection: 'row', gap: 8 }, fontButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#17223B' }, fontButtonText: { color: '#FFF', fontWeight: '900' },
  readerContent: { padding: 20, paddingBottom: 40 }, readerRange: { fontSize: 21, lineHeight: 31, fontWeight: '900', color: '#17223B', marginBottom: 20 }, section: { marginBottom: 18 }, chapterHeading: { fontSize: 19, fontWeight: '900', color: '#17223B', marginTop: 18, marginBottom: 8 }, verseText: { color: '#2E374A', marginBottom: 10 }, verseNumber: { fontWeight: '900', color: '#9A7C43' }, missingText: { color: '#A24A4A', fontWeight: '700' }, sourceBox: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#F0EEE7' }, sourceText: { fontSize: 11, lineHeight: 17, color: '#6B6F75' }, targetVerseWrap: { borderRadius: 8, paddingHorizontal: 4 },
  fixedChapterHeader: { paddingHorizontal: 18, paddingVertical: 11, backgroundColor: '#FFFEFB', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E3DED2', alignItems: 'center' }, fixedChapterHeaderText: { color: '#17223B', fontSize: 19, fontWeight: '900' },
  chapterNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 48 : 16, backgroundColor: '#F7F6F1', borderTopWidth: 1, borderTopColor: '#E3DED2', elevation: 8 }, chapterNavButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, chapterNavButtonText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, chapterNavCurrent: { minWidth: 88, textAlign: 'center', color: '#17223B', fontSize: 13, fontWeight: '900' },
  indexWrap: { padding: 22, paddingBottom: 45 }, indexHeaderRow: { width: '94%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }, indexLabel: { fontSize: 15, fontWeight: '900', color: '#17223B', marginTop: 18, marginBottom: 10 }, bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, bookChip: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ECEAE4' }, bookChipActive: { backgroundColor: '#17223B' }, bookChipText: { color: '#5D6470', fontWeight: '800', fontSize: 12 }, bookChipTextActive: { color: '#FFF' }, numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, numberChip: { width: 43, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#ECEAE4' }, numberChipActive: { backgroundColor: '#B28A48' }, numberChipText: { fontWeight: '900', color: '#5D6470' }, numberChipTextActive: { color: '#FFF' }, indexHint: { marginTop: 10, textAlign: 'center', fontSize: 11, lineHeight: 17, color: '#777' },
  dropdownButton: { marginBottom: 10, borderWidth: 1, borderColor: '#DED9CE', borderRadius: 14, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dropdownLabel: { fontSize: 13, fontWeight: '800', color: '#777E88' }, dropdownValue: { fontSize: 16, fontWeight: '900', color: '#17223B' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center', padding: 24 }, pickerCard: { width: '100%', maxHeight: '72%', backgroundColor: '#F7F6F1', borderRadius: 22, overflow: 'hidden' }, pickerList: { padding: 12, paddingBottom: 18 }, pickerOption: { minHeight: 52, paddingHorizontal: 16, borderRadius: 12, marginBottom: 7, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pickerOptionActive: { backgroundColor: '#17223B' }, pickerOptionText: { fontSize: 15, fontWeight: '800', color: '#343E50' }, pickerOptionTextActive: { color: '#FFF' }, pickerCheck: { color: '#D8B46C', fontSize: 17, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end' }, modalSheet: { height: '76%', backgroundColor: '#F7F6F1', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E5E1D8' }, modalTitle: { fontSize: 19, fontWeight: '900', color: '#17223B' }, modalSubtitle: { marginTop: 3, fontSize: 11, color: '#777' }, modalClose: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E9E5DC' }, modalCloseText: { fontWeight: '900', color: '#5E6570' }, dayList: { padding: 14, paddingBottom: 30 }, dayPickerRow: { height: 60, marginBottom: 8, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' }, dayPickerRowCompleted: { backgroundColor: '#E2E3E5' }, dayPickerTextCompleted: { color: '#8A8D92' }, dayPickerRowActive: { borderWidth: 2, borderColor: '#B28A48' }, dayPickerDay: { fontSize: 13, fontWeight: '900', color: '#17223B' }, dayPickerDayActive: { color: '#8B6B35' }, dayPickerReading: { marginTop: 3, fontSize: 11, color: '#777' }, dayPickerState: { width: 24, textAlign: 'center', color: '#B28A48', fontWeight: '900', fontSize: 17 },

  selectionBar: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#17223B', flexDirection: 'row', alignItems: 'center', gap: 8 }, selectionCount: { color: '#FFF', fontWeight: '900', marginRight: 'auto' }, selectionAction: { backgroundColor: '#FFF', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9 }, selectionActionText: { color: '#17223B', fontWeight: '900' }, selectionClear: { paddingHorizontal: 8, paddingVertical: 8 }, selectionClearText: { color: '#E9D5A9', fontWeight: '900' }, selectedVerseWrap: { backgroundColor: '#DCEBFA', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2 }, noteMark: { fontSize: 13 },
  indexWrapFlex: { flex: 1, paddingHorizontal: 30, paddingTop: 16, paddingBottom: 48, alignItems: 'center' }, testamentTabs: { width: '94%', flexDirection: 'row', backgroundColor: '#E8E5DD', borderRadius: 13, padding: 4, marginBottom: 10 }, testamentTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 }, testamentTabActive: { backgroundColor: '#17223B' }, testamentText: { color: '#6C727B', fontWeight: '900', fontSize: 16 }, testamentTextActive: { color: '#FFF' }, bibleSelectorColumns: { width: '94%', height: '58%', maxHeight: 450, flexDirection: 'row', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E3DED2', borderRadius: 15, overflow: 'hidden' }, selectorColumn: { flex: 0.75, borderLeftWidth: 1, borderLeftColor: '#E5E1D8' }, bookColumn: { flex: 1.8, borderLeftWidth: 0 }, selectorTitle: { textAlign: 'center', paddingVertical: 10, fontWeight: '900', color: '#777E88', backgroundColor: '#F3F1EB', borderBottomWidth: 1, borderBottomColor: '#E5E1D8' }, selectorRow: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F0EEE8' }, selectorRowActive: { backgroundColor: '#DCEBFA' }, selectorRowText: { color: '#283245', fontWeight: '800', fontSize: 14 }, selectorRowTextActive: { color: '#10223B', fontWeight: '900' }, indexOpenButton: { width: '94%', marginTop: 12, marginBottom: 24 },
  homologiaReaderSafe: { flex: 1, backgroundColor: '#F4F1E9' },
  homologiaReaderHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFFEFB', borderBottomWidth: 1, borderBottomColor: '#DED8C8', gap: 8 },
  homologiaBackButton: { paddingHorizontal: 8, paddingVertical: 10 },
  homologiaBackText: { color: '#0E5947', fontSize: 15, fontWeight: '900' },
  homologiaReaderHeading: { flex: 1, alignItems: 'center' },
  homologiaReaderTitle: { color: '#17223B', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  homologiaPageRange: { color: '#8A8170', fontSize: 10, fontWeight: '700', marginTop: 2 },
  homologiaFontTools: { flexDirection: 'row', gap: 5 },
  homologiaFontButton: { minWidth: 38, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 9, backgroundColor: '#17223B', alignItems: 'center' },
  homologiaFontButtonText: { color: '#FFF', fontWeight: '900' },
  homologiaPages: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: Platform.OS === 'android' ? 80 : 40, backgroundColor: '#FFFEFB' },
  homologiaPage: { backgroundColor: '#FFFEFB', borderRadius: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 22, marginBottom: 14, borderWidth: 1, borderColor: '#E5DECF' },
  homologiaPageNumber: { alignSelf: 'flex-end', color: '#9B9487', fontSize: 10, marginBottom: 2 },
  homologiaTextBlock: { width: '100%', borderRadius: 2 },
  noteModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 }, postIt: { width: '100%', backgroundColor: '#FFF2A8', borderRadius: 18, padding: 20, elevation: 8 }, postItTitle: { fontSize: 20, fontWeight: '900', color: '#554716' }, postItVerse: { marginTop: 5, marginBottom: 13, color: '#786725', fontWeight: '800' }, noteInput: { minHeight: 170, textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 12, padding: 14, color: '#413913', fontSize: 16, lineHeight: 24 }, noteButtons: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, noteRightButtons: { flexDirection: 'row', gap: 8 }, noteDelete: { paddingHorizontal: 12, paddingVertical: 10 }, noteDeleteText: { color: '#A04B3C', fontWeight: '900' }, noteCancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#E8D989' }, noteCancelText: { color: '#5A4D1E', fontWeight: '900' }, noteSave: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#17223B' }, noteSaveText: { color: '#FFF', fontWeight: '900' },

  celebrateBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', padding: 20 }, celebrateCard: { width: '100%', backgroundColor: '#FFFEFB', borderRadius: 24, padding: 22, alignItems: 'center' }, confetti: { fontSize: 30, marginBottom: 4 }, celebrateTitle: { fontSize: 30, fontWeight: '900', color: '#17223B', marginBottom: 18 }, celebrateSummary: { width: '100%', backgroundColor: '#FBF7EF', borderWidth: 1, borderColor: '#EADDBE', borderRadius: 18, padding: 18 }, celebrateSmall: { fontSize: 13, fontWeight: '800', color: '#747C86', marginBottom: 8 }, celebrateDayBadge: { alignSelf: 'flex-start', backgroundColor: '#17223B', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 }, celebrateDayText: { color: '#FFF', fontWeight: '900' }, celebrateStage: { fontSize: 16, lineHeight: 23, fontWeight: '900', color: '#8B6B35' }, celebrateDivider: { height: 1, backgroundColor: '#E8DDC6', marginVertical: 14 }, celebrateReading: { fontSize: 23, lineHeight: 32, fontWeight: '900', color: '#17223B' }, celebrateSuccess: { marginTop: 18, fontSize: 19, lineHeight: 28, fontWeight: '900', color: '#17223B', textAlign: 'center' }, finalCongrats: { marginTop: 8, fontSize: 13, lineHeight: 20, color: '#8B6B35', fontWeight: '800', textAlign: 'center' }, celebrateButton: { width: '100%', marginTop: 18, backgroundColor: '#173C70', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }, celebrateButtonText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
});
