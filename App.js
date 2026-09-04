import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, BackHandler, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, SafeAreaView, ScrollView, Share, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Buffer } from 'buffer';
import iconv from 'iconv-lite';
import Pdf from 'react-native-pdf';
import schedule from './assets/schedule.json';
import translations from './assets/bibles/translations.json';
import krv from './assets/bibles/krv.json';
import homologiaData from './assets/homologia.json';
import homologiaBoxes from './assets/homologia-boxes.json';
import homologiaPdfBase64 from './assets/homologia-pdf';
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, EmailAuthProvider, getReactNativePersistence, inMemoryPersistence,
  initializeAuth, onAuthStateChanged, reauthenticateWithCredential, signInAnonymously, signInWithEmailAndPassword, signOut, updatePassword,
} from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot,
  query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDjboFxfiXUBNVGiT-ecGhyc5_tH_vpq04',
  authDomain: 'gfc-bible-reading.firebaseapp.com',
  projectId: 'gfc-bible-reading',
  storageBucket: 'gfc-bible-reading.firebasestorage.app',
  messagingSenderId: '444394059472',
  appId: '1:444394059472:web:d2eb2dba7a9de7264bd0d5',
};
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const firebaseAuth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const firestore = getFirestore(firebaseApp);
const adminCreatorApp = initializeApp(FIREBASE_CONFIG, 'adminCreator');
const adminCreatorAuth = initializeAuth(adminCreatorApp, { persistence: inMemoryPersistence });
const memberApp = initializeApp(FIREBASE_CONFIG, 'memberClient');
const memberAuth = initializeAuth(memberApp, { persistence: getReactNativePersistence(AsyncStorage) });
const memberFirestore = getFirestore(memberApp);
const ADMIN_UID = 'XKWflFjskvSK016d8amlnTjLwX83';

const CURRENT_DAY_KEY = '@chronological_bible/current_day';
const COMPLETIONS_KEY = '@chronological_bible/completions';
const TRANSLATION_KEY = '@chronological_bible/translation';
const FONT_SIZE_KEY = '@chronological_bible/font_size';
const READER_POSITIONS_KEY = '@chronological_bible/reader_positions';
const VERSE_NOTES_KEY = '@chronological_bible/verse_notes';
const BIBLE_SELECTION_KEY = '@chronological_bible/bible_selection';
const HOMOLOGIA_FONT_SCALE_KEY = '@chronological_bible/homologia_font_scale';
const HOMOLOGIA_PDF_SCALE_KEY = '@chronological_bible/homologia_pdf_scale';
const HOMOLOGIA_PDF_POSITIONS_KEY = '@chronological_bible/homologia_pdf_positions';
const CUSTOM_TRANSLATIONS_KEY = '@chronological_bible/custom_translations';
const COMMUNITY_GROUPS_KEY = '@chronological_bible/community_groups';
const CURRENT_GROUP_KEY = '@chronological_bible/current_group';
const DEFAULT_GROUP = { id: 'gfc', name: 'GFC 교회' };
const createInviteCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};
const normalizeInviteCode = (value) => {
  const raw = String(value || '').toUpperCase().trim();
  const labeled = raw.match(/(?:초대\s*코드|INVITE\s*CODE)\s*[:：]?\s*([A-Z0-9][A-Z0-9\t -]{7,39})/i)?.[1];
  const candidates = (labeled ? [labeled] : (raw.match(/[A-Z0-9](?:[\s-]?[A-Z0-9]){7,31}/g) || [raw]))
    .map((item) => item.replace(/[^A-Z0-9]/g, ''))
    .filter((item) => item.length >= 8);
  return candidates.sort((a, b) => b.length - a.length)[0] || raw.replace(/[^A-Z0-9]/g, '');
};

const BIBLE_DATA = { KRV: krv };

const friendlyBdfName = (baseName, hasKorean = false) => {
  const compact = baseName.replace(/[^a-zA-Z0-9가-힣]/g, '');
  const code = compact.replace(/^CUSTOM/i, '').replace(/JSON$/i, '');
  if (hasKorean) {
    if (/kchktv/i.test(code)) return '바른성경 국한문';
    if (/kchnkrv|hnkrv/i.test(code)) return '개역개정 국한문';
    if (/kchhrv/i.test(code)) return '개역한글 국한문';
    if (/hchv/i.test(code)) return '개역 국한문';
    if (/korktv/i.test(code) || /^ktv$/i.test(code)) return '바른성경';
    if (/nkrv|gaeyukgaejung/i.test(code)) return '개역개정';
    if (/hrv|krv|gaeyukhangul/i.test(code)) return '개역한글';
    if (/knrsv|kornewstandard|saebeonyeok/i.test(code)) return '새번역';
    if (/nkcb|commonrevised/i.test(code)) return '공동번역 개정판';
    if (/kcb|commontranslation/i.test(code)) return '공동번역';
    if (/kkjv|koreankingjames/i.test(code)) return '한글킹제임스';
    if (/hkjv|heumjeong/i.test(code)) return '킹제임스 흠정역';
    if (/klb|livingbible/i.test(code)) return '현대인의 성경';
    if (/tkv|todaykorean/i.test(code)) return '현대어성경';
    if (/dob|woorimal/i.test(code)) return '우리말성경';
    if (/easy/i.test(code)) return '쉬운성경';
    if (/cath|catholic/i.test(code)) return '가톨릭성경';
    if (/kmsg|message/i.test(code)) return '한글 메시지성경';
    if (/[가-힣]/.test(baseName) && !/^한글\s*성경\s*\(/i.test(baseName)) return baseName.trim();
    return code || 'BDF';
  }
  return code.replace(/^ENG/i, '').toUpperCase() || 'BDF';
};

function decodeBdfBytes(bytes) {
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return Buffer.from(bytes).toString('utf8');
  }
  return iconv.decode(Buffer.from(bytes), 'cp949');
}

function parseBdfFiles(files) {
  const booksByNumber = new Map();
  let verseCount = 0;
  files.forEach(({ text }) => {
    text.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^(\d+).*?\s+(\d+):(\d+)\s+(.+)$/);
      if (!match) return;
      const bookNumber = Number(match[1]);
      const chapterNumber = Number(match[2]);
      const verseNumber = Number(match[3]);
      const body = match[4].trim();
      const meta = BIBLE_BOOKS[bookNumber - 1];
      if (!meta || !body) return;
      if (!booksByNumber.has(bookNumber)) {
        booksByNumber.set(bookNumber, { book: meta.book, koreanTitle: meta.ko, chapters: new Map() });
      }
      const book = booksByNumber.get(bookNumber);
      if (!book.chapters.has(chapterNumber)) book.chapters.set(chapterNumber, []);
      const verses = book.chapters.get(chapterNumber);
      const existing = verses.findIndex((verse) => verse.verse === verseNumber);
      const verse = { verse: verseNumber, text: body };
      if (existing >= 0) verses[existing] = verse;
      else verses.push(verse);
      verseCount += 1;
    });
  });
  const books = [...booksByNumber.entries()].sort((a, b) => a[0] - b[0]).map(([, book]) => ({
    book: book.book,
    koreanTitle: book.koreanTitle,
    chapters: [...book.chapters.entries()].sort((a, b) => a[0] - b[0]).map(([chapter, verses]) => ({
      chapter,
      verses: verses.sort((a, b) => a.verse - b.verse),
    })),
  }));
  return { books, verseCount };
}

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

const HOMOLOGIA_VIDEO_LINKS = [
  { title: '소리내어 성경읽기 1', url: 'https://www.youtube.com/watch?v=mMI4QV0h3k4' },
  { title: '소리내어 성경읽기 2', url: 'https://www.youtube.com/watch?v=Om7Eef_KDjs' },
  { title: '소성에 대한 간증', url: 'https://www.youtube.com/watch?v=WIN8FYvXCCg' },
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

const formatPostDate = (timestamp) => {
  const date = timestamp?.toDate?.();
  if (!date) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
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
  const [homologiaViewMode, setHomologiaViewMode] = useState('pdf');
  const [homologiaPdfScale, setHomologiaPdfScale] = useState(1);
  const [homologiaPdfStartPage, setHomologiaPdfStartPage] = useState(1);
  const [customBibles, setCustomBibles] = useState({});
  const [customTranslations, setCustomTranslations] = useState([]);
  const [importingBible, setImportingBible] = useState(false);
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false);
  const [noticeCategory, setNoticeCategory] = useState(null);
  const [selectedNoticePost, setSelectedNoticePost] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [adminUser, setAdminUser] = useState(null);
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [postEditor, setPostEditor] = useState(null);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [registeredTranslationsOpen, setRegisteredTranslationsOpen] = useState(false);
  const [adminRegisterOpen, setAdminRegisterOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminRecord, setAdminRecord] = useState(null);
  const [availableGroups, setAvailableGroups] = useState([DEFAULT_GROUP]);
  const [joinedGroupIds, setJoinedGroupIds] = useState([]);
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupCode, setEditGroupCode] = useState('');
  const [editGroupAddress, setEditGroupAddress] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const [groupAddress, setGroupAddress] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [adminRoomMode, setAdminRoomMode] = useState(false);
  const [adminGroupId, setAdminGroupId] = useState(null);
  const [adminGroupPickerOpen, setAdminGroupPickerOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [nextAdminPassword, setNextAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [adminDirectory, setAdminDirectory] = useState({});
  const [memberUser, setMemberUser] = useState(null);
  const [myMemberships, setMyMemberships] = useState({});
  const [nicknameEditorOpen, setNicknameEditorOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameTargetGroupId, setNicknameTargetGroupId] = useState(null);
  const [pendingJoinGroup, setPendingJoinGroup] = useState(null);
  const [memberManagerOpen, setMemberManagerOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [adminManagerOpen, setAdminManagerOpen] = useState(false);
  const [groupAdmins, setGroupAdmins] = useState([]);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferPassword, setTransferPassword] = useState('');
  const [memberSnapshotReady, setMemberSnapshotReady] = useState(false);

  const readerRef = useRef(null);
  const recordsRef = useRef(null);
  const lastScrollY = useRef(0);
  const pendingTargetY = useRef(null);
  const restoredKey = useRef(null);
  const homologiaPdfScaleRef = useRef(1);
  const homologiaPdfPositionsRef = useRef({});
  const nicknamePromptedRef = useRef(new Set());

  const isSuperAdmin = adminUser?.uid === ADMIN_UID;
  const isAdmin = !!adminUser && adminAuthorized;
  const currentGroup = availableGroups.find((group) => group.id === currentGroupId) || null;
  const currentGroupName = currentGroup?.name || '가입한 기관 없음';
  const visibleGroups = availableGroups.filter((group) => joinedGroupIds.includes(group.id));
  const managedGroupIds = isSuperAdmin
    ? availableGroups.map((group) => group.id)
    : [...new Set([...(adminRecord?.groupIds || []), ...Object.keys(adminRecord?.groupRoles || {})])]
      .filter((id) => ['manager', 'subAdmin'].includes(adminRecord?.groupRoles?.[id]) || (!adminRecord?.groupRoles && adminRecord?.groupIds?.includes(id)));
  const managedGroups = availableGroups.filter((group) => managedGroupIds.includes(group.id));
  const adminGroup = availableGroups.find((group) => group.id === adminGroupId) || null;
  const adminGroupName = adminGroup?.name || '관리 기관 선택';
  const canManageCurrentGroup = !!adminGroupId && (isSuperAdmin || (isAdmin && (
    adminRecord?.groupRoles
      ? ['manager', 'subAdmin'].includes(adminRecord.groupRoles[adminGroupId])
      : (adminRecord?.groupIds?.includes(adminGroupId) || (!adminRecord?.groupIds && adminGroupId === 'gfc'))
  )));
  const currentAdminRole = isSuperAdmin ? 'superAdmin' : (adminRecord?.groupRoles?.[adminGroupId]
    || (adminRecord?.groupIds?.includes(adminGroupId) ? (adminRecord?.role === 'subAdmin' ? 'subAdmin' : 'manager') : null));
  const canManagePeople = isSuperAdmin || currentAdminRole === 'manager';
  const currentMembership = currentGroupId ? myMemberships[currentGroupId] : null;
  const noticeGroupId = adminRoomMode ? adminGroupId : currentGroupId;
  const noticeGroupName = adminRoomMode ? adminGroupName : currentGroupName;
  const postsForCurrentGroup = communityPosts.filter((post) => (post.groupId || 'gfc') === noticeGroupId);

  useEffect(() => {
    if (!isAdmin) {
      setAdminRoomMode(false);
      setAdminGroupId(null);
      return;
    }
    if (!adminGroupId || !managedGroupIds.includes(adminGroupId)) setAdminGroupId(managedGroupIds[0] || null);
  }, [isAdmin, adminGroupId, managedGroupIds.join('|')]);

  useEffect(() => onAuthStateChanged(firebaseAuth, async (user) => {
    setAdminUser(user);
    if (!user) {
      setAdminAuthorized(false);
      setAdminRecord(null);
      return;
    }
    if (user.uid === ADMIN_UID) {
      setAdminAuthorized(true);
      setAdminRecord({ role: 'superAdmin', groupIds: [] });
      return;
    }
    try {
      const adminRecord = await getDoc(doc(firestore, 'admins', user.uid));
      const allowed = adminRecord.exists() && adminRecord.data()?.active !== false;
      setAdminAuthorized(allowed);
      setAdminRecord(allowed ? adminRecord.data() : null);
      if (!allowed) await signOut(firebaseAuth);
    } catch (error) {
      console.warn('Admin permission check failed:', error);
      setAdminAuthorized(false);
      await signOut(firebaseAuth).catch(() => {});
    }
  }), []);

  useEffect(() => {
    if (!adminUser || isSuperAdmin) return undefined;
    return onSnapshot(doc(firestore, 'admins', adminUser.uid), (snapshot) => {
      const allowed = snapshot.exists() && snapshot.data()?.active !== false;
      setAdminAuthorized(allowed);
      setAdminRecord(allowed ? snapshot.data() : null);
      if (!allowed) signOut(firebaseAuth).catch(() => {});
    }, (error) => console.warn('Admin permission listener failed:', error));
  }, [adminUser?.uid, isSuperAdmin]);

  useEffect(() => onSnapshot(collection(firestore, 'groups'), (snapshot) => {
    const remoteGroups = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const remoteGfc = remoteGroups.find((group) => group.id === 'gfc');
    const next = [{ ...DEFAULT_GROUP, ...(remoteGfc || {}) }, ...remoteGroups.filter((group) => group.id !== 'gfc')];
    setAvailableGroups(next);
  }, (error) => console.warn('Groups load failed:', error)), []);

  useEffect(() => onAuthStateChanged(memberAuth, (user) => {
    if (user) {
      setMemberUser(user);
      return;
    }
    signInAnonymously(memberAuth).catch((error) => console.warn('Anonymous member login failed:', error));
  }), []);

  useEffect(() => {
    if (!memberUser) return undefined;
    return onSnapshot(query(collection(memberFirestore, 'memberships'), where('memberUid', '==', memberUser.uid)), (snapshot) => {
      const next = {};
      snapshot.docs.forEach((item) => {
        const data = item.data();
        next[data.groupId] = { id: item.id, ...data };
      });
      setMyMemberships(next);
      setMemberSnapshotReady(true);
      const removedIds = Object.values(next).filter((item) => item.active === false).map((item) => item.groupId);
      if (removedIds.length) {
        setJoinedGroupIds((previous) => {
          const filtered = previous.filter((id) => !removedIds.includes(id));
          if (removedIds.includes(currentGroupId)) {
            const nextId = filtered[0] || null;
            setCurrentGroupId(nextId);
            if (nextId) AsyncStorage.setItem(CURRENT_GROUP_KEY, nextId).catch(() => {});
            else AsyncStorage.removeItem(CURRENT_GROUP_KEY).catch(() => {});
            setScreen('today');
          }
          if (filtered.length === previous.length) return previous;
          AsyncStorage.setItem(COMMUNITY_GROUPS_KEY, JSON.stringify(filtered)).catch(() => {});
          return filtered;
        });
      }
    }, (error) => console.warn('Membership load failed:', error));
  }, [memberUser, currentGroupId]);

  useEffect(() => {
    const savedMembership = currentGroupId ? myMemberships[currentGroupId] : null;
    if (!loaded || !memberSnapshotReady || !memberUser || !currentGroupId || !joinedGroupIds.includes(currentGroupId) || !!savedMembership) return;
    if (nicknamePromptedRef.current.has(currentGroupId)) return;
    nicknamePromptedRef.current.add(currentGroupId);
    setPendingJoinGroup(availableGroups.find((group) => group.id === currentGroupId) || { id: currentGroupId, name: currentGroupName });
    setNicknameTargetGroupId(currentGroupId);
    setNicknameDraft('');
    setNicknameEditorOpen(true);
  }, [loaded, memberSnapshotReady, memberUser, currentGroupId, joinedGroupIds, myMemberships, availableGroups, currentGroupName]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setAdminDirectory({});
      return;
    }
    getDocs(collection(firestore, 'admins')).then((snapshot) => {
      const directory = {};
      snapshot.docs.forEach((item) => { directory[item.id] = item.data()?.email || item.id; });
      if (adminUser?.uid) directory[adminUser.uid] = adminUser.email || '최고 관리자';
      setAdminDirectory(directory);
    }).catch((error) => console.warn('Admin directory load failed:', error));
  }, [isSuperAdmin, adminUser?.uid, adminRegisterOpen]);

  useEffect(() => {
    if (!canManagePeople || !adminGroupId) {
      setGroupMembers([]);
      setGroupAdmins([]);
      return undefined;
    }
    const unsubscribeMembers = onSnapshot(query(collection(firestore, 'memberships'), where('groupId', '==', adminGroupId)), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.active !== false);
      next.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', 'ko'));
      setGroupMembers(next);
    }, (error) => console.warn('Group members load failed:', error));
    const unsubscribeAdmins = onSnapshot(query(collection(firestore, 'admins'), where('groupIds', 'array-contains', adminGroupId)), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.active !== false && item.id !== ADMIN_UID && (!item.groupRoles || item.groupRoles[adminGroupId]));
      setGroupAdmins(next);
    }, (error) => console.warn('Group admins load failed:', error));
    return () => { unsubscribeMembers(); unsubscribeAdmins(); };
  }, [canManagePeople, adminGroupId]);

  useEffect(() => {
    if (!noticeGroupId || (adminRoomMode ? !canManageCurrentGroup : (!memberUser || currentMembership?.active === false))) {
      setCommunityPosts([]);
      setPostsLoading(false);
      return undefined;
    }
    setPostsLoading(true);
    const sourceDb = adminRoomMode ? firestore : memberFirestore;
    const sourceQuery = query(collection(sourceDb, 'communityPosts'), where('groupId', '==', noticeGroupId));
    const unsubscribe = onSnapshot(sourceQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      next.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setCommunityPosts(next);
      setPostsError('');
      setPostsLoading(false);
    }, (error) => {
      console.warn('Community posts load failed:', error);
      setPostsError('게시글을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
      setPostsLoading(false);
    });
    return unsubscribe;
  }, [noticeGroupId, adminRoomMode, memberUser, currentMembership?.active, canManageCurrentGroup]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const legacyPosts = communityPosts.filter((post) => !post.groupId);
    if (!legacyPosts.length) return;
    Promise.all(legacyPosts.map((post) => updateDoc(doc(firestore, 'communityPosts', post.id), {
      groupId: 'gfc', groupName: 'GFC 교회', updatedAt: serverTimestamp(),
    }))).catch((error) => console.warn('Legacy post migration failed:', error));
  }, [isSuperAdmin, communityPosts]);

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await AsyncStorage.multiGet([
          CURRENT_DAY_KEY, COMPLETIONS_KEY, TRANSLATION_KEY, FONT_SIZE_KEY, READER_POSITIONS_KEY, VERSE_NOTES_KEY, BIBLE_SELECTION_KEY, HOMOLOGIA_FONT_SCALE_KEY, HOMOLOGIA_PDF_SCALE_KEY, HOMOLOGIA_PDF_POSITIONS_KEY, CUSTOM_TRANSLATIONS_KEY, COMMUNITY_GROUPS_KEY, CURRENT_GROUP_KEY,
        ]);
        const saved = Object.fromEntries(rows);
        const d = Number(saved[CURRENT_DAY_KEY] || 1);
        const safeDay = Number.isFinite(d) && d >= 1 && d <= 365 ? d : 1;
        const savedGroups = safeParseJson(saved[COMMUNITY_GROUPS_KEY], []);
        const validGroups = Array.isArray(savedGroups) ? [...new Set(savedGroups)] : [];
        const savedCurrentGroup = saved[CURRENT_GROUP_KEY] || null;
        setJoinedGroupIds(validGroups);
        setCurrentGroupId(validGroups.includes(savedCurrentGroup) ? savedCurrentGroup : (validGroups[0] || null));
        setCurrentDay(safeDay);
        setDisplayDay(safeDay);
        const migrated = migrateCompletions(safeParseJson(saved[COMPLETIONS_KEY], {}));
        setCompletions(migrated);
        setTranslationId(saved[TRANSLATION_KEY] || 'KRV');
        const f = Number(saved[FONT_SIZE_KEY] || 19);
        setFontSize(Number.isFinite(f) ? Math.min(48, Math.max(15, f)) : 19);
        setReaderPositions(safeParseJson(saved[READER_POSITIONS_KEY], {}));
        setVerseNotes(safeParseJson(saved[VERSE_NOTES_KEY], {}));
        const homologiaScale = Number(saved[HOMOLOGIA_FONT_SCALE_KEY] || 1);
        setHomologiaFontScale(Number.isFinite(homologiaScale) ? Math.min(4, Math.max(0.75, homologiaScale)) : 1);
        const savedPdfScale = Number(saved[HOMOLOGIA_PDF_SCALE_KEY] || 1);
        const initialPdfScale = Number.isFinite(savedPdfScale) ? Math.min(5, Math.max(1, savedPdfScale)) : 1;
        homologiaPdfScaleRef.current = initialPdfScale;
        setHomologiaPdfScale(initialPdfScale);
        homologiaPdfPositionsRef.current = safeParseJson(saved[HOMOLOGIA_PDF_POSITIONS_KEY], {});
        const imported = safeParseJson(saved[CUSTOM_TRANSLATIONS_KEY], []);
        const loadedBibles = {};
        const validImported = [];
        for (const info of Array.isArray(imported) ? imported : []) {
          try {
            const storedFile = new File(Paths.document, 'bible-imports', info.fileName);
            if (!storedFile.exists) continue;
            const bibleData = JSON.parse(await storedFile.text());
            loadedBibles[info.id] = bibleData;
            const hasKorean = bibleData.books?.some((book) => book.chapters?.some((chapter) => chapter.verses?.some((verse) => /[가-힣]/.test(verse.text || ''))));
            const previousName = String(info.name || '').replace(/\s*\(개인\s*파일\)\s*$/i, '');
            const originalIdentifier = info.id || info.fileName || previousName;
            validImported.push({ ...info, name: friendlyBdfName(originalIdentifier, hasKorean) });
          } catch (error) {
            console.warn('Imported Bible load failed:', info?.id, error);
          }
        }
        setCustomBibles(loadedBibles);
        setCustomTranslations(validImported);
        await AsyncStorage.setItem(CUSTOM_TRANSLATIONS_KEY, JSON.stringify(validImported));
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
  const availableTranslations = useMemo(() => [
    ...translations,
    ...customTranslations.map((item) => ({ ...item, enabled: true })),
  ], [customTranslations]);
  const allBibleData = useMemo(() => ({ ...BIBLE_DATA, ...customBibles }), [customBibles]);
  const selectedTranslation = availableTranslations.find((t) => t.id === translationId) || availableTranslations[0];

  const completedRows = useMemo(() => (
    schedule
      .filter((i) => completions[String(i.day)]?.dates?.length)
      .map((i) => ({ ...i, completion: completions[String(i.day)] }))
      .sort((a, b) => a.day - b.day)
  ), [completions]);

  const bibleBooks = useMemo(() => normalizeBooks(allBibleData[translationId]), [allBibleData, translationId]);
  const canonicalBooks = useMemo(() => BIBLE_BOOKS.map((meta) => ({
    ...meta,
    data: getBook(allBibleData[translationId], meta.book, meta.ko),
  })).filter((x) => x.data), [allBibleData, translationId]);
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
    const data = allBibleData[translationId];
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
  }, [readerContext, translationId, allBibleData]);

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

  const loginAsAdmin = async () => {
    if (!adminEmail.trim() || !adminPassword) {
      Alert.alert('입력 확인', '관리자 이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setAdminBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, adminEmail.trim(), adminPassword);
      const loginAdminDoc = credential.user.uid === ADMIN_UID ? null : await getDoc(doc(firestore, 'admins', credential.user.uid));
      const allowed = credential.user.uid === ADMIN_UID
        || (loginAdminDoc.exists() && loginAdminDoc.data()?.active !== false);
      if (!allowed) {
        await signOut(firebaseAuth);
        Alert.alert('권한 없음', '등록된 관리자 계정이 아닙니다.');
        return;
      }
      setAdminAuthorized(true);
      setAdminPassword('');
      setAdminLoginOpen(false);
      Alert.alert('로그인 완료', credential.user.uid === ADMIN_UID ? '최고 관리자로 로그인했습니다.' : '담당 기관의 공지사항을 관리할 수 있습니다.');
    } catch (error) {
      console.warn('Admin login failed:', error);
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해 주세요.');
    } finally {
      setAdminBusy(false);
    }
  };

  const logoutAdmin = () => {
    Alert.alert('관리자 로그아웃', '로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', onPress: () => signOut(firebaseAuth).catch(() => {}) },
    ]);
  };

  const registerNewAdmin = async () => {
    if (!canManagePeople) return;
    if (!newAdminEmail.trim() || newAdminPassword.length < 6) {
      Alert.alert('입력 확인', '이메일과 6자리 이상의 임시 비밀번호를 입력해 주세요.');
      return;
    }
    setAdminBusy(true);
    try {
      const assignedRole = isSuperAdmin ? 'manager' : 'subAdmin';
      const existingAdmins = await getDocs(isSuperAdmin
        ? query(collection(firestore, 'admins'), where('email', '==', newAdminEmail.trim()))
        : query(collection(firestore, 'admins'), where('email', '==', newAdminEmail.trim()), where('groupIds', 'array-contains', adminGroupId)));
      if (!existingAdmins.empty) {
        const existingDoc = existingAdmins.docs[0];
        const data = existingDoc.data();
        if (data.active !== false && data.groupIds?.includes(adminGroupId)) {
          Alert.alert('등록 확인', '이미 이 기관의 관리자로 등록된 이메일입니다.');
          return;
        }
        await updateDoc(doc(firestore, 'admins', existingDoc.id), {
          active: true,
          groupIds: [...new Set([...(data.groupIds || []), adminGroupId])],
          groupRoles: { ...(data.groupRoles || {}), [adminGroupId]: assignedRole },
          updatedAt: serverTimestamp(),
        });
        setNewAdminEmail('');
        setNewAdminPassword('');
        setAdminRegisterOpen(false);
        Alert.alert('관리자 등록 완료', `${assignedRole === 'manager' ? '그룹관리자' : '부관리자'} 권한을 다시 활성화했습니다.`);
        return;
      }
      const credential = await createUserWithEmailAndPassword(
        adminCreatorAuth, newAdminEmail.trim(), newAdminPassword,
      );
      await setDoc(doc(firestore, 'admins', credential.user.uid), {
        uid: credential.user.uid,
        email: newAdminEmail.trim(),
        role: assignedRole === 'manager' ? 'groupAdmin' : 'subAdmin',
        groupIds: [adminGroupId],
        groupRoles: { [adminGroupId]: assignedRole },
        createdBy: adminUser.uid,
        createdAt: serverTimestamp(),
      });
      await signOut(adminCreatorAuth).catch(() => {});
      setNewAdminEmail('');
      setNewAdminPassword('');
      setAdminRegisterOpen(false);
      Alert.alert('관리자 등록 완료', `${adminGroupName}의 ${assignedRole === 'manager' ? '그룹관리자' : '부관리자'}가 등록되었습니다.`);
    } catch (error) {
      console.warn('Admin registration failed:', error);
      const duplicate = String(error?.code || '').includes('email-already-in-use');
      Alert.alert('등록 실패', duplicate ? '이미 사용 중인 이메일입니다.' : '관리자를 등록하지 못했습니다. 입력 내용을 확인해 주세요.');
    } finally {
      setAdminBusy(false);
    }
  };

  const changeAdminPassword = async () => {
    if (!adminUser?.email) return;
    if (!currentAdminPassword || nextAdminPassword.length < 6) {
      Alert.alert('입력 확인', '현재 비밀번호와 6자리 이상의 새 비밀번호를 입력해 주세요.');
      return;
    }
    if (nextAdminPassword !== confirmAdminPassword) {
      Alert.alert('입력 확인', '새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    if (currentAdminPassword === nextAdminPassword) {
      Alert.alert('입력 확인', '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.');
      return;
    }
    setAdminBusy(true);
    try {
      const credential = EmailAuthProvider.credential(adminUser.email, currentAdminPassword);
      await reauthenticateWithCredential(adminUser, credential);
      await updatePassword(adminUser, nextAdminPassword);
      setCurrentAdminPassword('');
      setNextAdminPassword('');
      setConfirmAdminPassword('');
      setPasswordChangeOpen(false);
      Alert.alert('변경 완료', '관리자 비밀번호가 안전하게 변경되었습니다.');
    } catch (error) {
      console.warn('Password change failed:', error);
      const code = String(error?.code || '');
      Alert.alert('변경 실패', code.includes('invalid-credential') || code.includes('wrong-password')
        ? '현재 비밀번호가 올바르지 않습니다.'
        : '비밀번호를 변경하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      setAdminBusy(false);
    }
  };

  const removeSubAdmin = (target) => {
    const targetRole = target.groupRoles?.[adminGroupId] || (target.role === 'subAdmin' ? 'subAdmin' : 'manager');
    if (!canManagePeople || (!isSuperAdmin && targetRole !== 'subAdmin')) return;
    Alert.alert('관리자 권한 삭제', `${target.email}의 ${adminGroupName} 관리 권한을 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '권한 삭제', style: 'destructive', onPress: async () => {
        try {
          const nextIds = [...new Set([...(target.groupIds || []), adminGroupId])];
          const nextRoles = { ...(target.groupRoles || {}) };
          delete nextRoles[adminGroupId];
          await updateDoc(doc(firestore, 'admins', target.id), {
            groupIds: nextIds, groupRoles: nextRoles, active: Object.keys(nextRoles).length > 0, updatedAt: serverTimestamp(),
          });
        } catch { Alert.alert('삭제 실패', '관리자 권한을 삭제하지 못했습니다.'); }
      } },
    ]);
  };

  const transferManagerRole = async () => {
    if (!adminUser?.email || currentAdminRole !== 'manager' || !transferTarget) return;
    if (!transferPassword) {
      Alert.alert('입력 확인', '현재 비밀번호를 입력해 주세요.');
      return;
    }
    setAdminBusy(true);
    try {
      await reauthenticateWithCredential(adminUser, EmailAuthProvider.credential(adminUser.email, transferPassword));
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'admins', transferTarget.id), {
        groupRoles: { ...(transferTarget.groupRoles || {}), [adminGroupId]: 'manager' },
        role: 'groupAdmin', updatedAt: serverTimestamp(),
      });
      const myRoles = { ...(adminRecord?.groupRoles || {}), [adminGroupId]: 'subAdmin' };
      batch.update(doc(firestore, 'admins', adminUser.uid), {
        groupRoles: myRoles, role: 'subAdmin', updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setAdminRecord((previous) => ({ ...(previous || {}), groupRoles: myRoles, role: 'subAdmin' }));
      setTransferPassword('');
      setTransferTarget(null);
      setAdminManagerOpen(false);
      Alert.alert('권한 승계 완료', `${transferTarget.email} 관리자가 새 그룹관리자가 되었습니다. 본인은 부관리자로 변경되었습니다.`);
    } catch (error) {
      console.warn('Manager transfer failed:', error);
      const code = String(error?.code || '');
      Alert.alert('승계 실패', code.includes('invalid-credential') || code.includes('wrong-password') ? '현재 비밀번호가 올바르지 않습니다.' : '권한을 승계하지 못했습니다.');
    } finally {
      setAdminBusy(false);
    }
  };

  const selectCommunityGroup = async (groupId) => {
    setCurrentGroupId(groupId);
    setGroupPickerOpen(false);
    setSelectedNoticePost(null);
    setNoticeCategory(null);
    await AsyncStorage.setItem(CURRENT_GROUP_KEY, groupId);
  };

  const joinCommunityGroup = async () => {
    if (!memberUser) {
      Alert.alert('잠시만 기다려 주세요', '회원번호를 준비하고 있습니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    const normalizedCode = normalizeInviteCode(joinCode);
    if (!normalizedCode) {
      Alert.alert('입력 확인', '초대 코드를 입력해 주세요.');
      return;
    }
    setAdminBusy(true);
    try {
      let snapshot = await getDocs(query(collection(memberFirestore, 'groups'), where('normalizedInviteCode', '==', normalizedCode)));
      let groupDoc = snapshot.docs[0];
      if (!groupDoc) {
        snapshot = await getDocs(collection(memberFirestore, 'groups'));
        const pastedText = String(joinCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        groupDoc = snapshot.docs.find((item) => {
          const storedCode = normalizeInviteCode(item.data()?.normalizedInviteCode);
          return storedCode && (storedCode === normalizedCode || pastedText.includes(storedCode));
        });
      }
      if (!groupDoc) {
        Alert.alert('기관을 찾을 수 없음', '초대 코드를 다시 확인해 주세요.');
        return;
      }
      // 존재하지 않는 회원 문서를 먼저 읽으면 Firestore 규칙상 권한 오류가 납니다.
      // 내 회원목록 구독에서 이미 확인한 값만 사용하고 새 가입은 바로 진행합니다.
      const existing = myMemberships[groupDoc.id];
      if (existing?.removedByAdmin) {
        Alert.alert('가입 제한', '기관 관리자에 의해 탈퇴 처리된 회원번호입니다. 기관 관리자에게 문의해 주세요.');
        return;
      }
      setJoinCode('');
      setJoinGroupOpen(false);
      setPendingJoinGroup({ id: groupDoc.id, ...groupDoc.data() });
      setNicknameTargetGroupId(groupDoc.id);
      setNicknameDraft(existing?.nickname || '');
      setNicknameEditorOpen(true);
    } catch (error) {
      console.warn('Group join failed:', error);
      Alert.alert('가입 실패', '교회·기관 정보를 확인하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      setAdminBusy(false);
    }
  };

  const openNicknameEditor = (groupId = currentGroupId) => {
    setNicknameTargetGroupId(groupId);
    setNicknameDraft(myMemberships[groupId]?.nickname || '');
    setPendingJoinGroup(null);
    setNicknameEditorOpen(true);
  };

  const nicknameRemainingText = (membership) => {
    const changedAt = membership?.nicknameChangedAt?.toMillis?.();
    if (!changedAt) return '';
    const remaining = (24 * 60 * 60 * 1000) - (Date.now() - changedAt);
    if (remaining <= 0) return '';
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.ceil((remaining % 3600000) / 60000);
    return `${hours}시간 ${minutes}분 후 다시 변경할 수 있습니다.`;
  };

  const saveMemberNickname = async () => {
    if (!memberUser || !nicknameTargetGroupId) return;
    const nickname = nicknameDraft.trim();
    if (nickname.length < 2 || nickname.length > 20) {
      Alert.alert('입력 확인', '닉네임은 2~20자로 입력해 주세요.');
      return;
    }
    const membershipId = `${nicknameTargetGroupId}_${memberUser.uid}`;
    const existing = myMemberships[nicknameTargetGroupId];
    const remaining = nicknameRemainingText(existing);
    if (existing?.nickname && existing.nickname !== nickname && remaining) {
      Alert.alert('변경 대기 중', remaining);
      return;
    }
    setAdminBusy(true);
    try {
      await setDoc(doc(memberFirestore, 'memberships', membershipId), {
        groupId: nicknameTargetGroupId,
        memberUid: memberUser.uid,
        nickname,
        inviteCode: pendingJoinGroup?.normalizedInviteCode || existing?.inviteCode || currentGroup?.normalizedInviteCode || '',
        previousNickname: existing?.nickname && existing.nickname !== nickname ? existing.nickname : (existing?.previousNickname || ''),
        active: true,
        removedByAdmin: false,
        joinedAt: existing?.joinedAt || serverTimestamp(),
        nicknameChangedAt: existing?.nickname && existing.nickname !== nickname ? serverTimestamp() : (existing?.nicknameChangedAt || null),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const nextIds = [...new Set([...joinedGroupIds, nicknameTargetGroupId])];
      setJoinedGroupIds(nextIds);
      setCurrentGroupId(nicknameTargetGroupId);
      await AsyncStorage.multiSet([[COMMUNITY_GROUPS_KEY, JSON.stringify(nextIds)], [CURRENT_GROUP_KEY, nicknameTargetGroupId]]);
      const joinedName = pendingJoinGroup?.name;
      setNicknameEditorOpen(false);
      setPendingJoinGroup(null);
      Alert.alert(existing?.nickname ? '닉네임 변경 완료' : '기관 가입 완료', existing?.nickname ? '닉네임이 변경되었습니다.' : `${joinedName || '선택한 기관'}에 가입했습니다.`);
    } catch (error) {
      console.warn('Nickname save failed:', error);
      Alert.alert('저장 실패', '닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setAdminBusy(false);
    }
  };

  const leaveCurrentGroup = () => {
    if (!currentGroupId || !memberUser) return;
    const leavingId = currentGroupId;
    Alert.alert('교회·기관 탈퇴', `${currentGroupName}에서 탈퇴하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: async () => {
        // 탈퇴 처리 중 관리자 로그아웃과 회원정보 구독이 순서대로 갱신되더라도
        // 방금 탈퇴한 기관의 가입창이 자동으로 다시 열리지 않게 합니다.
        nicknamePromptedRef.current.add(leavingId);
        setJoinGroupOpen(false);
        setNicknameEditorOpen(false);
        setPendingJoinGroup(null);
        setNicknameTargetGroupId(null);
        setJoinCode('');
        try {
          let signedOutFromAdmin = false;
          if (isAdmin && !isSuperAdmin && adminRecord) {
            const legacyRole = adminRecord.role === 'subAdmin' ? 'subAdmin' : 'manager';
            const previousRoles = adminRecord.groupRoles || Object.fromEntries((adminRecord.groupIds || []).map((id) => [id, legacyRole]));
            if (previousRoles[leavingId]) {
              const nextRoles = { ...previousRoles };
              delete nextRoles[leavingId];
              const nextAdminGroupIds = (adminRecord.groupIds || Object.keys(previousRoles)).filter((id) => id !== leavingId);
              const remainingRoles = Object.values(nextRoles);
              const nextActive = remainingRoles.length > 0;
              await updateDoc(doc(firestore, 'admins', adminUser.uid), {
                groupIds: nextAdminGroupIds,
                groupRoles: nextRoles,
                active: nextActive,
                role: remainingRoles.includes('manager') ? 'groupAdmin' : (nextActive ? 'subAdmin' : 'formerAdmin'),
                updatedAt: serverTimestamp(),
              });
              if (!nextActive) {
                await signOut(firebaseAuth).catch(() => {});
                signedOutFromAdmin = true;
              }
            }
          }
          await setDoc(doc(memberFirestore, 'memberships', `${leavingId}_${memberUser.uid}`), {
            active: false, removedByAdmin: false, leftAt: serverTimestamp(), updatedAt: serverTimestamp(),
          }, { merge: true });
          const nextIds = joinedGroupIds.filter((id) => id !== leavingId);
          setJoinedGroupIds(nextIds);
          const nextId = nextIds[0] || null;
          setCurrentGroupId(nextId);
          await AsyncStorage.setItem(COMMUNITY_GROUPS_KEY, JSON.stringify(nextIds));
          if (nextId) await AsyncStorage.setItem(CURRENT_GROUP_KEY, nextId);
          else await AsyncStorage.removeItem(CURRENT_GROUP_KEY);
          setScreen('today');
          Alert.alert('탈퇴 완료', `${currentGroupName}에서 탈퇴했습니다.${isAdmin && !isSuperAdmin ? '\n해당 기관의 관리자 권한도 해제되었습니다.' : ''}${signedOutFromAdmin ? '\n관리자 계정에서 로그아웃되었습니다.' : ''}`);
        } catch (error) {
          console.warn('Group leave failed:', error);
          Alert.alert('탈퇴 실패', '기관 탈퇴 또는 관리자 권한 해제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
      } },
    ]);
  };

  const removeGroupMember = (member) => {
    if (!canManagePeople) return;
    Alert.alert('회원 탈퇴 처리', `${member.nickname} 회원을 기관에서 탈퇴 처리하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴 처리', style: 'destructive', onPress: async () => {
        try {
          await updateDoc(doc(firestore, 'memberships', member.id), {
            active: false, removedByAdmin: true, removedAt: serverTimestamp(), removedBy: adminUser.uid,
          });
          Alert.alert('탈퇴 처리 완료', `${member.nickname} 회원을 ${adminGroupName}에서 탈퇴 처리했습니다.`);
        } catch (error) {
          console.warn('Member removal failed:', error);
          Alert.alert('처리 실패', '회원을 탈퇴 처리하지 못했습니다. 인터넷 연결과 관리자 권한을 확인해 주세요.');
        }
      } },
    ]);
  };

  const createCommunityGroup = async () => {
    if (!isSuperAdmin) return;
    const name = newGroupName.trim();
    const normalizedCode = newGroupCode || createInviteCode();
    if (!name) {
      Alert.alert('입력 확인', '교회·기관 이름을 입력해 주세요.');
      return;
    }
    setAdminBusy(true);
    try {
      const duplicate = await getDocs(query(collection(firestore, 'groups'), where('normalizedInviteCode', '==', normalizedCode)));
      if (!duplicate.empty) {
        Alert.alert('코드 중복', '이미 사용 중인 초대 코드입니다.');
        return;
      }
      const created = await addDoc(collection(firestore, 'groups'), {
        name, normalizedInviteCode: normalizedCode, createdBy: adminUser.uid,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      const managementCode = `ORG-${created.id.slice(0, 6).toUpperCase()}`;
      await updateDoc(doc(firestore, 'groups', created.id), { managementCode });
      setNewGroupName('');
      setNewGroupCode('');
      setCreateGroupOpen(false);
      setAdminGroupId(created.id);
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(normalizedCode);
      Alert.alert('기관 생성 완료', `${name}이 만들어졌습니다.\n관리번호: ${managementCode}\n\n초대 코드: ${normalizedCode}\n\n초대 코드를 클립보드에 복사했습니다.`);
    } catch (error) {
      console.warn('Group creation failed:', error);
      Alert.alert('생성 실패', '교회·기관을 만들지 못했습니다.');
    } finally {
      setAdminBusy(false);
    }
  };

  const openGroupEditor = (group) => {
    setEditGroupName(group.name || '');
    setEditGroupCode(group.normalizedInviteCode || '');
    setEditGroupAddress(group.address || '');
    setEditGroupDescription(group.description || '');
    setGroupManagerOpen(false);
    setEditingGroup(group);
  };

  const openGroupProfileEditor = () => {
    if (!canManagePeople || !adminGroup) return;
    setGroupAddress(adminGroup.address || '');
    setGroupDescription(adminGroup.description || '');
    setGroupProfileOpen(true);
  };

  const saveGroupProfile = async () => {
    if (!canManagePeople || !adminGroupId) return;
    setAdminBusy(true);
    try {
      await setDoc(doc(firestore, 'groups', adminGroupId), {
        address: groupAddress.trim(), description: groupDescription.trim(), updatedAt: serverTimestamp(),
      }, { merge: true });
      setGroupProfileOpen(false);
      Alert.alert('저장 완료', '교회·기관 소개가 저장되었습니다.');
    } catch (error) {
      console.warn('Group profile update failed:', error);
      Alert.alert('저장 실패', '교회·기관 소개를 저장하지 못했습니다.');
    } finally {
      setAdminBusy(false);
    }
  };

  const shareGroupInvite = async (group = adminGroup || currentGroup) => {
    const code = group?.normalizedInviteCode;
    if (!code) {
      Alert.alert('초대 코드 없음', '먼저 초대 코드를 설정해 주세요.');
      return;
    }
    try {
      await Share.share({
        title: `${group.name} 초대`,
        message: `${group.name}에 초대합니다.\n연대기별 성경통독 일정표 앱에서 아래 초대 코드를 입력해 주세요.\n\n초대 코드: ${code}`,
      });
    } catch (error) {
      console.warn('Invite share failed:', error);
      Alert.alert('공유 실패', '초대 코드를 공유하지 못했습니다.');
    }
  };

  const copyGroupInviteCode = async (group = adminGroup) => {
    const code = group?.normalizedInviteCode;
    if (!code) {
      Alert.alert('초대 코드 없음', '먼저 초대 코드를 설정해 주세요.');
      return;
    }
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(code);
      Alert.alert('복사 완료', `${group.name} 초대 코드를 복사했습니다.`);
    } catch (error) {
      console.warn('Invite code copy failed:', error);
      Alert.alert('복사 실패', '초대 코드를 복사하지 못했습니다.');
    }
  };

  const saveGroupChanges = async () => {
    if (!isSuperAdmin || !editingGroup) return;
    const name = editGroupName.trim();
    const normalizedCode = editGroupCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!name || normalizedCode.length < 8) {
      Alert.alert('입력 확인', '기관 이름과 8자리 이상의 초대 코드가 필요합니다.');
      return;
    }
    setAdminBusy(true);
    try {
      const duplicate = await getDocs(query(collection(firestore, 'groups'), where('normalizedInviteCode', '==', normalizedCode)));
      if (duplicate.docs.some((item) => item.id !== editingGroup.id)) {
        Alert.alert('코드 중복', '이미 사용 중인 초대 코드입니다.');
        return;
      }
      await setDoc(doc(firestore, 'groups', editingGroup.id), {
        name, normalizedInviteCode: normalizedCode, address: editGroupAddress.trim(),
        description: editGroupDescription.trim(), updatedAt: serverTimestamp(),
      }, { merge: true });
      const codeChanged = normalizedCode !== editingGroup.normalizedInviteCode;
      if (codeChanged) {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(normalizedCode);
      }
      setEditingGroup(null);
      Alert.alert('수정 완료', `${name} 정보가 변경되었습니다.${codeChanged ? '\n새 초대 코드를 클립보드에 복사했습니다.' : ''}`);
    } catch (error) {
      console.warn('Group update failed:', error);
      Alert.alert('수정 실패', '교회·기관 정보를 변경하지 못했습니다.');
    } finally {
      setAdminBusy(false);
    }
  };

  const removeCommunityGroup = (group) => {
    if (!isSuperAdmin) return;
    if (group.id === 'gfc') {
      Alert.alert('기본 기관', 'GFC 교회는 기존 게시글 보호를 위해 삭제할 수 없습니다. 이름과 초대 코드는 수정할 수 있습니다.');
      return;
    }
    Alert.alert(
      '교회·기관 삭제',
      `${group.name}을 삭제하시겠습니까?\n해당 기관의 게시글도 모두 삭제되며 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: async () => {
          setAdminBusy(true);
          try {
            const groupPosts = communityPosts.filter((post) => post.groupId === group.id);
            await Promise.all(groupPosts.map((post) => deleteDoc(doc(firestore, 'communityPosts', post.id))));
            await deleteDoc(doc(firestore, 'groups', group.id));
            const nextJoined = joinedGroupIds.filter((id) => id !== group.id);
            setJoinedGroupIds(nextJoined);
            await AsyncStorage.setItem(COMMUNITY_GROUPS_KEY, JSON.stringify(nextJoined));
            if (currentGroupId === group.id) {
              const nextId = nextJoined[0] || null;
              setCurrentGroupId(nextId);
              if (nextId) await AsyncStorage.setItem(CURRENT_GROUP_KEY, nextId);
              else await AsyncStorage.removeItem(CURRENT_GROUP_KEY);
            }
            if (adminGroupId === group.id) setAdminGroupId(managedGroupIds.find((id) => id !== group.id) || null);
            Alert.alert('삭제 완료', `${group.name}이 삭제되었습니다.`);
          } catch (error) {
            console.warn('Group deletion failed:', error);
            Alert.alert('삭제 실패', '교회·기관을 삭제하지 못했습니다.');
          } finally {
            setAdminBusy(false);
          }
        } },
      ],
    );
  };

  const openPostEditor = (post = null) => {
    setPostTitle(post?.title || '');
    setPostBody(post?.body || '');
    setPostEditor(post || { category: noticeCategory, groupId: noticeGroupId, groupName: noticeGroupName });
  };

  const saveCommunityPost = async () => {
    if (!canManageCurrentGroup) return;
    if (!postTitle.trim() || !postBody.trim()) {
      Alert.alert('입력 확인', '제목과 내용을 모두 입력해 주세요.');
      return;
    }
    setAdminBusy(true);
    try {
      if (postEditor?.id) {
        await updateDoc(doc(firestore, 'communityPosts', postEditor.id), {
          title: postTitle.trim(), body: postBody.trim(), updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(firestore, 'communityPosts'), {
          category: postEditor?.category || noticeCategory,
          groupId: postEditor?.groupId || noticeGroupId,
          groupName: postEditor?.groupName || noticeGroupName,
          title: postTitle.trim(),
          body: postBody.trim(),
          authorUid: adminUser.uid,
          authorEmail: adminUser.email || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setPostEditor(null);
      setPostTitle('');
      setPostBody('');
    } catch (error) {
      console.warn('Community post save failed:', error);
      Alert.alert('저장 실패', '글을 저장하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    } finally {
      setAdminBusy(false);
    }
  };

  const removeCommunityPost = (post) => {
    if (!canManageCurrentGroup) return;
    Alert.alert('게시글 삭제', '이 글을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try { await deleteDoc(doc(firestore, 'communityPosts', post.id)); }
          catch { Alert.alert('삭제 실패', '글을 삭제하지 못했습니다.'); }
        },
      },
    ]);
  };

  const confirmAppExit = () => {
    if (Platform.OS !== 'android') {
      Alert.alert('종료 안내', 'iPhone에서는 홈 화면으로 이동해 주세요.');
      return;
    }
    Alert.alert('앱 종료', '종료하시겠습니까?', [
      { text: '아니요', style: 'cancel' },
      { text: '예', onPress: () => BackHandler.exitApp() },
    ]);
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'homologiaReader') {
        setHomologiaPdfScale(homologiaPdfScaleRef.current);
        setScreen('homologia');
      }
      else if (screen === 'notice' && selectedNoticePost) setSelectedNoticePost(null);
      else if (screen === 'notice' && noticeCategory) setNoticeCategory(null);
      else if (screen === 'notice' && adminRoomMode) {
        setAdminRoomMode(false);
        setScreen('settings');
      }
      else if (screen === 'notice') confirmAppExit();
      else if (screen === 'settings') {
        setDisplayDay(currentDay);
        setScreen('today');
      }
      else if (screen === 'reader') closeReader(readerContext?.type === 'chapter' ? 'bibleIndex' : 'today');
      else confirmAppExit();
      return true;
    });
    return () => subscription.remove();
  }, [screen, readerKey, readerPositions, readerContext?.type, noticeCategory, selectedNoticePost, currentDay, adminRoomMode]);

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
    const next = Math.min(48, Math.max(15, fontSize + delta));
    setFontSize(next);
    await AsyncStorage.setItem(FONT_SIZE_KEY, String(next));
  };

  const cycleTranslation = async () => {
    const enabled = availableTranslations.filter((t) => t.enabled);
    if (enabled.length <= 1) {
      Alert.alert('번역본 선택', '현재는 개역한글만 설치되어 있습니다. 추후 번역본을 추가하면 이 버튼에서 선택할 수 있습니다.');
      return;
    }
    const idx = enabled.findIndex((t) => t.id === translationId);
    const next = enabled[(idx + 1) % enabled.length];
    setTranslationId(next.id);
    await AsyncStorage.setItem(TRANSLATION_KEY, next.id);
  };

  const chooseTranslation = async (id) => {
    setTranslationId(id);
    setTranslationPickerOpen(false);
    await AsyncStorage.setItem(TRANSLATION_KEY, id);
    const targetBooks = BIBLE_BOOKS.map((meta) => ({
      ...meta,
      data: getBook(allBibleData[id], meta.book, meta.ko),
    })).filter((item) => item.data);
    const currentExists = targetBooks.some((item) => item.book === selectedBookKey);
    if (!currentExists && targetBooks[0]) {
      const first = targetBooks[0];
      setTestament(first.testament);
      setSelectedBookKey(first.book);
      setSelectedChapter(1);
      setSelectedVerse(1);
      if (screen === 'reader' && readerContext?.type === 'chapter') {
        setReaderContext({ type: 'chapter', book: first.book, bookKo: first.ko, chapter: 1, verse: 1 });
        restoredKey.current = null;
        pendingTargetY.current = 0;
      }
    }
  };

  const TranslationPicker = () => (
    <Modal visible={translationPickerOpen} transparent animationType="fade" onRequestClose={() => setTranslationPickerOpen(false)}>
      <TouchableOpacity activeOpacity={1} onPress={() => setTranslationPickerOpen(false)} style={styles.pickerBackdrop}>
        <View style={styles.translationPickerCard} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>성경 번역본 선택</Text>
              <Text style={styles.modalSubtitle}>읽으려는 번역본을 눌러 주세요.</Text>
            </View>
            <TouchableOpacity onPress={() => setTranslationPickerOpen(false)} style={styles.modalClose}><Text style={styles.modalCloseText}>닫기</Text></TouchableOpacity>
          </View>
          <FlatList
            data={availableTranslations.filter((item) => item.enabled)}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.translationPickerList}
            renderItem={({ item }) => {
              const active = item.id === translationId;
              return (
                <TouchableOpacity onPress={() => chooseTranslation(item.id)} style={[styles.translationPickerRow, active && styles.translationPickerRowActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.translationPickerName, active && styles.translationPickerNameActive]}>{item.name}</Text>
                    {item.sourceFiles ? <Text style={[styles.translationPickerMeta, active && styles.translationPickerMetaActive]}>{item.sourceFiles}개 BDF 파일 · {(item.verseCount || 0).toLocaleString()}절</Text> : <Text style={[styles.translationPickerMeta, active && styles.translationPickerMetaActive]}>기본 번역본</Text>}
                  </View>
                  <Text style={[styles.translationPickerCheck, active && styles.translationPickerCheckActive]}>{active ? '✓' : ''}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const importBibleFolder = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('안내', '현재 BDF 폴더 등록은 안드로이드에서 사용할 수 있습니다.');
      return;
    }
    setImportingBible(true);
    try {
      const selectedDirectory = await Directory.pickDirectoryAsync();
      if (!selectedDirectory) return;
      const bdfFiles = selectedDirectory.list().filter((item) => item.name?.toLowerCase().endsWith('.bdf'));
      if (!bdfFiles.length) {
        Alert.alert('BDF 파일 없음', '선택한 폴더에서 .bdf 파일을 찾지 못했습니다.');
        return;
      }

      const groups = new Map();
      for (const file of bdfFiles) {
        const base = file.name.replace(/\.bdf$/i, '').replace(/\d+$/, '') || file.name.replace(/\.bdf$/i, '');
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base).push({ name: file.name, text: decodeBdfBytes(await file.bytes()) });
      }

      const importsDirectory = new Directory(Paths.document, 'bible-imports');
      importsDirectory.create({ idempotent: true, intermediates: true });
      const nextBibles = { ...customBibles };
      let nextTranslations = [...customTranslations];
      const summaries = [];

      for (const [base, files] of groups.entries()) {
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const parsed = parseBdfFiles(files);
        if (!parsed.books.length) continue;
        const hasKorean = parsed.books.some((book) => book.chapters?.some((chapter) => chapter.verses?.some((verse) => /[가-힣]/.test(verse.text || ''))));
        const id = `CUSTOM_${base.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
        const fileName = `${id}.json`;
        const storedFile = new File(importsDirectory, fileName);
        storedFile.create({ overwrite: true, intermediates: true });
        storedFile.write(JSON.stringify({ books: parsed.books }));
        const info = { id, name: friendlyBdfName(base, hasKorean), fileName, sourceFiles: files.length, verseCount: parsed.verseCount };
        nextBibles[id] = { books: parsed.books };
        nextTranslations = [...nextTranslations.filter((item) => item.id !== id), info];
        summaries.push(`${info.name}: ${parsed.books.length}권 · ${parsed.verseCount.toLocaleString()}절`);
      }

      if (!summaries.length) {
        Alert.alert('등록 실패', '책·장·절 형식을 확인할 수 있는 BDF 파일이 없습니다.');
        return;
      }
      setCustomBibles(nextBibles);
      setCustomTranslations(nextTranslations);
      await AsyncStorage.setItem(CUSTOM_TRANSLATIONS_KEY, JSON.stringify(nextTranslations));
      Alert.alert('성경번역본 등록 완료', summaries.join('\n'));
    } catch (error) {
      if (!String(error?.message || error).toLowerCase().includes('cancel')) {
        console.warn('BDF import failed:', error);
        Alert.alert('등록 오류', 'BDF 파일을 읽지 못했습니다. 파일들이 들어 있는 폴더를 다시 선택해 주세요.');
      }
    } finally {
      setImportingBible(false);
    }
  };

  const removeCustomTranslation = (item) => {
    Alert.alert('번역본 삭제', `${item.name}을 이 휴대폰에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          const storedFile = new File(Paths.document, 'bible-imports', item.fileName);
          if (storedFile.exists) storedFile.delete();
        } catch (error) {
          console.warn('Imported Bible file delete failed:', error);
        }
        const nextTranslations = customTranslations.filter((entry) => entry.id !== item.id);
        const nextBibles = { ...customBibles };
        delete nextBibles[item.id];
        setCustomTranslations(nextTranslations);
        setCustomBibles(nextBibles);
        await AsyncStorage.setItem(CUSTOM_TRANSLATIONS_KEY, JSON.stringify(nextTranslations));
        if (translationId === item.id) {
          setTranslationId('KRV');
          await AsyncStorage.setItem(TRANSLATION_KEY, 'KRV');
        }
      }},
    ]);
  };

  const exitApp = () => {
    confirmAppExit();
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
      .flatMap((page) => {
        const boxDefinitions = homologiaBoxes[String(page.page)] || [];
        return page.blocks.flatMap((block, blockIndex) => {
          const boxStart = boxDefinitions.find((box) => box.start === blockIndex);
          if (boxStart) {
            return [{
              type: 'boxImage',
              imageUri: `data:image/png;base64,${boxStart.data}`,
              imageWidth: boxStart.width,
              imageHeight: boxStart.height,
              gap: block.gap,
            }];
          }
          if (boxDefinitions.some((box) => blockIndex > box.start && blockIndex <= box.end)) return [];
          return [{
            ...block,
            spans: block.spans.filter((span, spanIndex) => !(
              blockIndex === 0
              && spanIndex === 0
              && Number(span.size) <= 12
              && span.text.trim() === String(page.page)
            )),
          }];
        });
      })
      .filter((block) => {
        if (block.type === 'boxImage') return true;
        const text = block.spans.map((span) => span.text).join('').trim();
        return text && !text.includes('책 처음으로 이동') && !text.includes('첫페이지로 이동');
      });

    const blockText = (block) => block.spans?.map((span) => span.text).join('').trim() || '';
    const sectionBlocks = sourceBlocks.reduce((flow, block) => {
      const previous = flow[flow.length - 1];
      const previousText = previous ? blockText(previous) : '';
      const currentText = blockText(block);
      const previousIsBody = previous && previous.type !== 'boxImage' && !previous.background && previous.align === 'left' && (previous.baseSize || 28) <= 28.5;
      const currentIsBody = block.type !== 'boxImage' && !block.background && block.align === 'left' && (block.baseSize || 28) <= 28.5;
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
      flow.push({
        ...block,
        ...(block.spans ? { spans: [...block.spans] } : {}),
        paragraphBreak: flow.length > 0,
      });
      return flow;
    }, []);

    const changeHomologiaFont = (delta) => setHomologiaFontScale((value) => {
      const next = Math.min(4, Math.max(0.75, Number((value + delta).toFixed(2))));
      AsyncStorage.setItem(HOMOLOGIA_FONT_SCALE_KEY, String(next))
        .catch((error) => console.warn('Homologia font size save failed:', error));
      return next;
    });

    const formatFlowingText = (spans, spanIndex, preserveLines) => {
      const text = spans[spanIndex]?.text || '';
      if (preserveLines) return text.replace(/\n{3,}/g, '\n\n');
      return text.replace(/[ \t]*\n[ \t]*/g, ' ');
    };

    const openHomologiaLink = (url) => Linking.openURL(url)
      .catch(() => Alert.alert('링크 열기 실패', '영상 링크를 열 수 없습니다.'));

    const saveHomologiaPdfPage = (page) => {
      if (!Number.isFinite(page) || homologiaSectionIndex === null) return;
      homologiaPdfPositionsRef.current = {
        ...homologiaPdfPositionsRef.current,
        [String(homologiaSectionIndex)]: page,
      };
      AsyncStorage.setItem(HOMOLOGIA_PDF_POSITIONS_KEY, JSON.stringify(homologiaPdfPositionsRef.current))
        .catch((error) => console.warn('Homologia PDF position save failed:', error));
    };

    return (
      <SafeAreaView style={styles.homologiaReaderSafe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.homologiaReaderHeader}>
          <TouchableOpacity onPress={() => { setHomologiaPdfScale(homologiaPdfScaleRef.current); setScreen('homologia'); }} style={styles.homologiaBackButton}>
            <Text style={styles.homologiaBackText}>‹ 목록</Text>
          </TouchableOpacity>
          <View style={styles.homologiaReaderHeading}>
            <Text style={styles.homologiaReaderTitle}>{HOMOLOGIA_MENUS[homologiaSectionIndex]?.title}</Text>
            <Text style={styles.homologiaPageRange}>원본 구성 · 글자 보기</Text>
          </View>
          <View style={styles.homologiaFontTools}>
            {homologiaViewMode === 'text' && (
              <>
                <TouchableOpacity onPress={() => changeHomologiaFont(-0.25)} style={styles.homologiaFontButton}><Text style={styles.homologiaFontButtonText}>A−</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => changeHomologiaFont(0.25)} style={styles.homologiaFontButton}><Text style={styles.homologiaFontButtonText}>A+</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
        <View style={styles.homologiaViewSwitch}>
          <TouchableOpacity
            onPress={() => setHomologiaViewMode('text')}
            style={[styles.homologiaViewButton, homologiaViewMode === 'text' && styles.homologiaViewButtonActive]}
          >
            <Text style={[styles.homologiaViewButtonText, homologiaViewMode === 'text' && styles.homologiaViewButtonTextActive]}>글자 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setHomologiaViewMode('pdf')}
            style={[styles.homologiaViewButton, homologiaViewMode === 'pdf' && styles.homologiaViewButtonActive]}
          >
            <Text style={[styles.homologiaViewButtonText, homologiaViewMode === 'pdf' && styles.homologiaViewButtonTextActive]}>PDF 원본 보기</Text>
          </TouchableOpacity>
        </View>
        {homologiaViewMode === 'pdf' && (
          <View style={styles.homologiaVideoLinks}>
            {HOMOLOGIA_VIDEO_LINKS.map((link) => (
              <TouchableOpacity key={link.url} onPress={() => openHomologiaLink(link.url)} style={styles.homologiaVideoLinkButton}>
                <Text numberOfLines={1} style={styles.homologiaVideoLinkText}>▶ {link.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {homologiaViewMode === 'pdf' ? (
          <Pdf
            key={`homologia-pdf-${homologiaSectionIndex}`}
            source={{ uri: `data:application/pdf;base64,${homologiaPdfBase64[homologiaSectionIndex]}` }}
            page={homologiaPdfStartPage}
            scale={homologiaPdfScale}
            minScale={1}
            maxScale={5}
            enablePaging={false}
            enableAnnotationRendering
            onScaleChanged={(scale) => {
              const safeScale = Math.min(5, Math.max(1, Number(scale) || 1));
              homologiaPdfScaleRef.current = safeScale;
              AsyncStorage.setItem(HOMOLOGIA_PDF_SCALE_KEY, String(safeScale))
                .catch((error) => console.warn('Homologia PDF scale save failed:', error));
            }}
            onPressLink={openHomologiaLink}
            onPageChanged={(page) => saveHomologiaPdfPage(page)}
            onError={(error) => {
              console.warn('Homologia PDF open failed:', error);
              Alert.alert('PDF 열기 실패', 'PDF 원본을 열 수 없습니다. 글자 보기로 확인해 주세요.');
              setHomologiaViewMode('text');
            }}
            style={styles.homologiaPdf}
          />
        ) : (
        <FlatList
          data={sectionBlocks}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.homologiaPages}
          initialNumToRender={12}
          windowSize={7}
          renderItem={({ item: block }) => {
            if (block.type === 'boxImage') {
              return (
                <View style={[styles.homologiaBoxImageWrap, { marginTop: block.paragraphBreak ? Math.max(block.gap || 5, 14) : (block.gap || 5) }]}>
                  <Image
                    source={{ uri: block.imageUri }}
                    resizeMode="contain"
                    style={[styles.homologiaBoxImage, { aspectRatio: block.imageWidth / block.imageHeight }]}
                  />
                </View>
              );
            }
            const baseFontSize = Math.round(Math.max(12, Math.min(30, (block.baseSize || 28) * 0.62)) * homologiaFontScale);
            const isHeading = block.align === 'center' || (block.baseSize || 28) > 28.5;
            const blockLineHeight = Math.round(baseFontSize * (isHeading ? 1.38 : 1.55));
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
                        textDecorationLine: span.url ? 'underline' : 'none',
                      }}
                      onPress={span.url ? () => Linking.openURL(span.url).catch(() => Alert.alert('링크 열기 실패', '영상 링크를 열 수 없습니다.')) : undefined}
                    >{formatFlowingText(block.spans, spanIndex, true)}</Text>
                  ))}
                </Text>
              </View>
            );
          }}
        />
        )}
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
          <TouchableOpacity onPress={() => setTranslationPickerOpen(true)} style={styles.translationButton}>
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
            <Text style={styles.sourceText}>{translationId === 'KRV' ? '성경전서 개역한글판 (1961) · 본문 출처 표시 및 동일성 유지' : `${selectedTranslation.name} · 이 휴대폰에 개인 등록된 번역본`}</Text>
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

        <TranslationPicker />

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
          <TouchableOpacity disabled={visibleGroups.length === 0} onPress={() => { setAdminRoomMode(false); setSelectedNoticePost(null); setNoticeCategory(null); setScreen('notice'); }} style={[styles.tab, screen === 'notice' && !adminRoomMode && styles.tabActive, visibleGroups.length === 0 && styles.tabDisabled]}><Text style={[styles.tabText, screen === 'notice' && !adminRoomMode && styles.tabTextActive, visibleGroups.length === 0 && styles.tabTextDisabled]}>공지사항</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('homologia')} style={[styles.tab, screen === 'homologia' && styles.tabActive]}><Text style={[styles.tabText, screen === 'homologia' && styles.tabTextActive]}>GF호물로기아</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('bibleIndex')} style={[styles.tab, screen === 'bibleIndex' && styles.tabActive]}><Text style={[styles.tabText, screen === 'bibleIndex' && styles.tabTextActive]}>성경보기</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setDisplayDay(currentDay); setScreen('today'); }} style={[styles.tab, screen === 'today' && styles.tabActive]}><Text style={[styles.tabText, screen === 'today' && styles.tabTextActive]}>오늘 일정</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('records')} style={[styles.tab, screen === 'records' && styles.tabActive]}><Text style={[styles.tabText, screen === 'records' && styles.tabTextActive]}>완료기록</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('settings')} style={[styles.tab, screen === 'settings' && styles.tabActive]}><Text style={[styles.tabText, screen === 'settings' && styles.tabTextActive]}>설정</Text></TouchableOpacity>
        </View>

        {screen === 'notice' ? (
          selectedNoticePost ? (
            <ScrollView contentContainerStyle={styles.noticeDetailScreen}>
              <Text style={styles.currentGroupLabel}>{adminRoomMode ? '관리자 관리실 · ' : ''}{noticeGroupName}</Text>
              <TouchableOpacity onPress={() => setSelectedNoticePost(null)} style={styles.noticeBackButton}><Text style={styles.noticeBackText}>‹ {noticeCategory === 'news' ? `${noticeGroupName} 소식` : '중보기도'}</Text></TouchableOpacity>
              <View style={styles.noticePostCard}>
                <Text style={styles.noticePostTitle}>{selectedNoticePost.title}</Text>
                <Text style={styles.noticePostDate}>{selectedNoticePost.createdAt?.toDate?.().toLocaleDateString('ko-KR') || '방금 전'}</Text>
                {isSuperAdmin && <Text style={styles.noticePostAuthor}>작성 관리자 · {selectedNoticePost.authorEmail || adminDirectory[selectedNoticePost.authorUid] || selectedNoticePost.authorUid || '확인할 수 없음'}</Text>}
                <Text style={styles.noticePostBody}>{selectedNoticePost.body}</Text>
                {adminRoomMode && canManageCurrentGroup && <View style={styles.noticePostActions}>
                  <TouchableOpacity onPress={() => openPostEditor(selectedNoticePost)} style={styles.noticeEditButton}><Text style={styles.noticeEditText}>수정</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => { removeCommunityPost(selectedNoticePost); setSelectedNoticePost(null); }} style={styles.noticeDeleteButton}><Text style={styles.noticeDeleteText}>삭제</Text></TouchableOpacity>
                </View>}
              </View>
            </ScrollView>
          ) : noticeCategory ? (
            <View style={styles.noticeListScreen}>
              <TouchableOpacity onPress={() => adminRoomMode ? setAdminGroupPickerOpen(true) : setGroupPickerOpen(true)} style={styles.groupSelectorCompact}><Text style={styles.groupSelectorCompactText}>{adminRoomMode ? '🛠 관리자 관리실' : '🏠'} · {noticeGroupName}  ▼</Text></TouchableOpacity>
              <View style={styles.noticeListHeader}>
                <TouchableOpacity onPress={() => setNoticeCategory(null)} style={styles.noticeBackButton}><Text style={styles.noticeBackText}>‹ 공지사항</Text></TouchableOpacity>
                <Text style={styles.noticeListTitle}>{noticeCategory === 'news' ? `${noticeGroupName} 소식` : '중보기도'}</Text>
                {adminRoomMode && canManageCurrentGroup ? <TouchableOpacity onPress={() => openPostEditor()} style={styles.writePostButton}><Text style={styles.writePostButtonText}>＋ 글쓰기</Text></TouchableOpacity> : <View style={styles.noticeHeaderSpacer} />}
              </View>
              {postsLoading ? <View style={styles.noticeMessage}><Text style={styles.placeholderText}>게시글을 불러오는 중입니다…</Text></View> : postsError ? <View style={styles.noticeMessage}><Text style={styles.noticeErrorText}>{postsError}</Text></View> : (
                <FlatList
                  data={postsForCurrentGroup.filter((post) => post.category === noticeCategory)}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.noticeListContent}
                  ListEmptyComponent={<View style={styles.noticeEmptyCard}><Text style={styles.noticeEmptyTitle}>아직 등록된 글이 없습니다.</Text><Text style={styles.placeholderText}>{adminRoomMode ? '오른쪽 위의 글쓰기 버튼으로 첫 글을 등록해 주세요.' : '새로운 글이 등록되면 이곳에 표시됩니다.'}</Text></View>}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setSelectedNoticePost(item)} style={styles.noticeTitleRow}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.noticeTitleRowText}>{item.title}</Text>
                      <Text style={styles.noticeTitleRowDate}>{formatPostDate(item.createdAt)}</Text>
                      <Text style={styles.noticeTitleArrow}>›</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          ) : (
            <ScrollView
              style={styles.noticeMenuScroll}
              contentContainerStyle={styles.noticeMenuScreen}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.placeholderTitle}>공지사항</Text>
              <TouchableOpacity onPress={() => adminRoomMode ? setAdminGroupPickerOpen(true) : setGroupPickerOpen(true)} style={styles.groupSelector}><Text style={styles.groupSelectorName}>{adminRoomMode ? '🛠 관리자 관리실' : '🏠'} · {noticeGroupName}</Text><Text style={styles.groupSelectorHint}>기관 변경  ▼</Text></TouchableOpacity>
              <Text style={styles.placeholderText}>선택한 교회·기관의 공지사항입니다.</Text>
              {adminRoomMode && canManagePeople && <TouchableOpacity onPress={() => setMemberManagerOpen(true)} style={styles.memberManagementShortcut}>
                <View>
                  <Text style={styles.memberManagementShortcutTitle}>👥 회원 목록 · 탈퇴 관리</Text>
                  <Text style={styles.memberManagementShortcutDescription}>현재 가입 회원 {groupMembers.length}명</Text>
                </View>
                <Text style={styles.memberManagementShortcutArrow}>›</Text>
              </TouchableOpacity>}
              <View style={styles.noticeMenuButtons}>
                {[{ key: 'news', icon: '📢', title: `${noticeGroupName} 소식` }, { key: 'prayer', icon: '🙏', title: '중보기도' }].map((menu) => {
                  const previewPosts = postsForCurrentGroup.filter((post) => post.category === menu.key).slice(0, 5);
                  return <View key={menu.key} style={styles.noticeMenuButton}>
                    <TouchableOpacity onPress={() => setNoticeCategory(menu.key)} style={styles.noticeMenuHeading}>
                      <Text style={styles.noticeMenuIcon}>{menu.icon}</Text><Text style={styles.noticeMenuTitle}>{menu.title}</Text>
                    </TouchableOpacity>
                    <View style={styles.noticePreviewList}>
                      {previewPosts.length ? previewPosts.map((post) => <TouchableOpacity key={post.id} onPress={() => { setNoticeCategory(menu.key); setSelectedNoticePost(post); }} style={styles.noticePreviewRow}><Text numberOfLines={1} ellipsizeMode="tail" style={styles.noticePreviewTitle}>• {post.title}</Text><Text style={styles.noticePreviewDate}>{formatPostDate(post.createdAt)}</Text></TouchableOpacity>) : <Text style={styles.noticePreviewEmpty}>등록된 글이 없습니다.</Text>}
                    </View>
                    <TouchableOpacity onPress={() => setNoticeCategory(menu.key)}><Text style={styles.noticeMoreText}>전체보기 ›</Text></TouchableOpacity>
                  </View>;
                })}
              </View>
              {adminRoomMode && canManageCurrentGroup && <View style={styles.settingsCard}>
                <Text style={styles.settingsCardTitle}>{noticeGroupName} 관리</Text>
                <Text style={styles.settingsDescription}>게시글 작성과 회원·관리자 관리는 이 관리실 안에서만 적용됩니다.</Text>
                <View style={styles.generatedCodeBox}><Text style={styles.generatedCodeLabel}>기관 초대코드</Text><Text selectable style={styles.generatedCodeText}>{adminGroup?.normalizedInviteCode || '미설정'}</Text></View>
                <View style={styles.memberProfileActions}><TouchableOpacity onPress={() => copyGroupInviteCode(adminGroup)} style={styles.memberProfileButton}><Text style={styles.memberProfileButtonText}>초대코드 복사</Text></TouchableOpacity><TouchableOpacity onPress={() => shareGroupInvite(adminGroup)} style={styles.memberProfileButton}><Text style={styles.memberProfileButtonText}>카카오톡·문자로 공유</Text></TouchableOpacity></View>
                {canManagePeople && <TouchableOpacity onPress={() => setMemberManagerOpen(true)} style={styles.registerAdminButton}><Text style={styles.registerAdminButtonText}>회원 목록 및 탈퇴 관리</Text></TouchableOpacity>}
                {canManagePeople && <TouchableOpacity onPress={() => setAdminManagerOpen(true)} style={styles.registerAdminButton}><Text style={styles.registerAdminButtonText}>관리자 목록 및 권한 관리</Text></TouchableOpacity>}
                {canManagePeople && <TouchableOpacity onPress={() => setAdminRegisterOpen(true)} style={styles.registerAdminButton}><Text style={styles.registerAdminButtonText}>＋ {isSuperAdmin ? '그룹관리자' : '부관리자'} 등록</Text></TouchableOpacity>}
                {canManagePeople && <TouchableOpacity onPress={openGroupProfileEditor} style={styles.groupManageButton}><Text style={styles.groupManageButtonText}>기관 주소·소개 입력</Text></TouchableOpacity>}
                {isSuperAdmin && <TouchableOpacity onPress={() => { setNewGroupCode(createInviteCode()); setCreateGroupOpen(true); }} style={styles.superAdminButton}><Text style={styles.superAdminButtonText}>＋ 새 교회·기관 만들기</Text></TouchableOpacity>}
                {isSuperAdmin && <TouchableOpacity onPress={() => setGroupManagerOpen(true)} style={styles.groupManageButton}><Text style={styles.groupManageButtonText}>전체 교회·기관 수정 및 삭제</Text></TouchableOpacity>}
              </View>}
            </ScrollView>
          )
        ) : screen === 'homologia' ? (
          <ScrollView contentContainerStyle={styles.homologiaScreen} showsVerticalScrollIndicator={false}>
            <Text style={styles.homologiaTitle}>GF호물로기아</Text>
            <Text style={styles.homologiaSubtitle}>원하는 메뉴를 선택해 주세요.</Text>
            <View style={styles.homologiaGrid}>
              {HOMOLOGIA_MENUS.map((menu) => (
                <TouchableOpacity
                  key={menu.title}
                  onPress={() => {
                    const savedPage = Number(homologiaPdfPositionsRef.current[String(menu.sectionIndex)]);
                    const section = homologiaData.sections[menu.sectionIndex];
                    const sectionLength = section.endPage - section.startPage + 1;
                    const restoredPage = savedPage >= section.startPage && savedPage <= section.endPage
                      ? savedPage - section.startPage + 1
                      : (savedPage >= 1 && savedPage <= sectionLength ? savedPage : 1);
                    setHomologiaPdfStartPage(restoredPage);
                    setHomologiaSectionIndex(menu.sectionIndex);
                    setHomologiaViewMode('pdf');
                    setScreen('homologiaReader');
                  }}
                  style={[styles.homologiaButton, { backgroundColor: menu.color }]}
                >
                  <Text style={styles.homologiaButtonText}>{menu.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : screen === 'settings' ? (
          <ScrollView contentContainerStyle={styles.settingsScreen}>
            <Text style={styles.settingsTitle}>설정</Text>
            <Text style={styles.settingsSectionTitle}>교회·기관</Text>
            <View style={styles.settingsCard}>
              <Text style={styles.settingsCardTitle}>기관 설정</Text>
              <Text style={styles.settingsDescription}>{joinedGroupIds.length ? `현재 공지 기관: ${currentGroupName}\n기관 변경은 공지사항 화면에서 할 수 있습니다.` : '교회·기관에 가입하지 않아도 성경 통독 기능은 모두 사용할 수 있습니다. 기관 공지가 필요할 때만 초대 코드를 입력하세요.'}</Text>
              {!!currentGroupId && currentMembership?.active !== false && <View style={styles.memberProfileBox}>
                <Text style={styles.memberProfileLabel}>내 닉네임</Text>
                <Text style={styles.memberProfileName}>{currentMembership?.nickname || '닉네임 등록 필요'}</Text>
                {currentMembership?.previousNickname ? <Text style={styles.memberProfileMeta}>이전 닉네임 · {currentMembership.previousNickname}</Text> : null}
                <Text style={styles.memberProfileMeta}>회원번호 · {memberUser?.uid ? `M-${memberUser.uid.slice(-6).toUpperCase()}` : '준비 중'}</Text>
                {nicknameRemainingText(currentMembership) ? <Text style={styles.nicknameWaitText}>{nicknameRemainingText(currentMembership)}</Text> : null}
                <View style={styles.memberProfileActions}><TouchableOpacity onPress={() => openNicknameEditor()} style={styles.memberProfileButton}><Text style={styles.memberProfileButtonText}>{currentMembership?.nickname ? '닉네임 변경' : '닉네임 등록'}</Text></TouchableOpacity><TouchableOpacity onPress={leaveCurrentGroup} style={styles.memberLeaveButton}><Text style={styles.memberLeaveButtonText}>기관 탈퇴</Text></TouchableOpacity></View>
              </View>}
              {visibleGroups.length > 1 && <TouchableOpacity onPress={() => setGroupPickerOpen(true)} style={styles.groupManageButton}><Text style={styles.groupManageButtonText}>현재 기관 변경</Text></TouchableOpacity>}
              <TouchableOpacity onPress={() => setJoinGroupOpen(true)} style={styles.registerAdminButton}><Text style={styles.registerAdminButtonText}>＋ 초대 코드로 기관 가입</Text></TouchableOpacity>
            </View>
            <View style={styles.settingsSectionGap} />
            <Text style={styles.settingsSectionTitle}>개인 성경 번역본</Text>
            <View style={styles.settingsCard}>
              <Text style={styles.settingsCardTitle}>BDF 성경 데이터 등록</Text>
              <Text style={styles.settingsDescription}>성경 데이터가 들어 있는 폴더를 선택하면 같은 이름의 분할 BDF 파일들을 하나의 번역본으로 합쳐 이 휴대폰에만 저장합니다.</Text>
              <TouchableOpacity disabled={importingBible} onPress={importBibleFolder} style={[styles.importBibleButton, importingBible && styles.importBibleButtonDisabled]}>
                <Text style={styles.importBibleButtonText}>{importingBible ? 'BDF 파일 확인 중…' : '＋ 성경번역본 추가'}</Text>
              </TouchableOpacity>
              <Text style={styles.privateImportNotice}>APK와 GitHub에는 개인 번역본이 포함되지 않으며 인터넷 연결 없이 사용합니다.</Text>
            </View>
            {customTranslations.length > 0 && <TouchableOpacity onPress={() => setRegisteredTranslationsOpen((value) => !value)} style={styles.registeredTranslationsButton}>
              <Text style={styles.registeredTranslationsButtonText}>등록된 번역본 보기 ({customTranslations.length})</Text><Text style={styles.registeredTranslationsArrow}>{registeredTranslationsOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>}
            {customTranslations.length > 0 && registeredTranslationsOpen && (
              <View style={styles.importedList}>
                {customTranslations.map((item) => (
                  <View key={item.id} style={styles.importedBibleRow}>
                    <View style={styles.importedBibleInfo}>
                      <Text style={styles.importedBibleName}>{item.name}</Text>
                      <Text style={styles.importedBibleMeta}>{item.sourceFiles || 1}개 파일 · {(item.verseCount || 0).toLocaleString()}절</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeCustomTranslation(item)} style={styles.importedBibleDelete}>
                      <Text style={styles.importedBibleDeleteText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.adminSettingsBlock}>
              <Text style={styles.settingsSectionTitle}>관리자 관리실</Text>
              <View style={styles.settingsCard}>
                <Text style={styles.settingsCardTitle}>{isSuperAdmin ? '최고 관리자 로그인됨' : isAdmin ? '기관 관리자 로그인됨' : '관리자 로그인'}</Text>
                <Text style={styles.settingsDescription}>{isSuperAdmin ? '일반 회원 화면과 분리된 관리실에서 모든 기관을 관리합니다.' : isAdmin ? '관리실에서 담당 기관을 선택해 게시글과 회원을 관리합니다.' : '지정된 관리자만 별도의 관리실에 들어갈 수 있습니다.'}</Text>
                <TouchableOpacity onPress={isAdmin ? logoutAdmin : () => setAdminLoginOpen(true)} style={[styles.importBibleButton, isAdmin && styles.adminLogoutButton]}>
                  <Text style={styles.importBibleButtonText}>{isAdmin ? '관리자 로그아웃' : '관리자 로그인'}</Text>
                </TouchableOpacity>
                {isAdmin && <TouchableOpacity onPress={() => setPasswordChangeOpen(true)} style={styles.changePasswordButton}><Text style={styles.changePasswordButtonText}>내 비밀번호 변경</Text></TouchableOpacity>}
                {isAdmin && <TouchableOpacity disabled={!managedGroups.length} onPress={() => { setAdminRoomMode(true); setSelectedNoticePost(null); setNoticeCategory(null); setScreen('notice'); }} style={[styles.superAdminButton, !managedGroups.length && styles.importBibleButtonDisabled]}><Text style={styles.superAdminButtonText}>관리자 관리실 들어가기</Text></TouchableOpacity>}
              </View>
            </View>
          </ScrollView>
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
              <TouchableOpacity onPress={() => setTranslationPickerOpen(true)} style={styles.translationButton}><Text style={styles.translationText}>{selectedTranslation.name} ▼</Text></TouchableOpacity>
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

      <TranslationPicker />

      <Modal visible={nicknameEditorOpen} transparent animationType="fade" onRequestClose={() => { setNicknameEditorOpen(false); setPendingJoinGroup(null); }}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.adminModalCard}>
            <Text style={styles.adminModalTitle}>{pendingJoinGroup ? `${pendingJoinGroup.name} 가입` : '내 닉네임 변경'}</Text>
            <Text style={styles.adminModalDescription}>기관에서 사용할 닉네임을 입력해 주세요. 변경하면 24시간 동안 다시 변경할 수 없습니다.</Text>
            <TextInput value={nicknameDraft} onChangeText={setNicknameDraft} maxLength={20} autoFocus placeholder="닉네임 (2~20자)" style={styles.adminInput} />
            <View style={styles.adminModalActions}>
              <TouchableOpacity disabled={adminBusy} onPress={() => { setNicknameEditorOpen(false); setPendingJoinGroup(null); }} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
              <TouchableOpacity disabled={adminBusy} onPress={saveMemberNickname} style={styles.adminLoginButton}><Text style={styles.adminLoginText}>{adminBusy ? '저장 중…' : pendingJoinGroup ? '가입' : '저장'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={memberManagerOpen} transparent animationType="fade" onRequestClose={() => setMemberManagerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.groupManagerCard}>
            <Text style={styles.adminModalTitle}>{adminGroupName} 회원</Text>
            <Text style={styles.adminModalDescription}>닉네임이 같아도 회원번호와 가입일로 구별할 수 있습니다.</Text>
            <ScrollView style={styles.groupManagerList}>
              {groupMembers.length ? groupMembers.map((member) => <View key={member.id} style={styles.groupManageRow}><View style={styles.groupManageInfo}><Text style={styles.groupManageName}>{member.nickname}</Text>{member.previousNickname ? <Text style={styles.groupManageMeta}>이전 닉네임 {member.previousNickname}</Text> : null}<Text style={styles.groupManageMeta}>회원번호 M-{String(member.memberUid || '').slice(-6).toUpperCase()}</Text><Text style={styles.groupManageMeta}>가입일 {member.joinedAt?.toDate?.().toLocaleDateString('ko-KR') || '확인 중'}</Text></View><TouchableOpacity onPress={() => removeGroupMember(member)} style={styles.groupDeleteButton}><Text style={styles.groupDeleteButtonText}>탈퇴 처리</Text></TouchableOpacity></View>) : <Text style={styles.managerEmptyText}>등록된 회원이 없습니다.</Text>}
            </ScrollView>
            <TouchableOpacity onPress={() => setMemberManagerOpen(false)} style={styles.groupManagerClose}><Text style={styles.adminLoginText}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={adminManagerOpen} transparent animationType="fade" onRequestClose={() => setAdminManagerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.groupManagerCard}>
            <Text style={styles.adminModalTitle}>{adminGroupName} 관리자</Text>
            <Text style={styles.adminModalDescription}>그룹관리자는 회원과 부관리자를 관리하며, 부관리자는 게시글을 관리합니다.</Text>
            <ScrollView style={styles.groupManagerList}>
              {groupAdmins.length ? groupAdmins.map((item) => {
                const role = item.groupRoles?.[adminGroupId] || (item.role === 'subAdmin' ? 'subAdmin' : 'manager');
                return <View key={item.id} style={styles.adminManageRow}><View style={styles.groupManageInfo}><Text style={styles.groupManageName}>{item.email}</Text><Text style={styles.adminRoleText}>{role === 'manager' ? '그룹관리자' : '부관리자'}</Text></View><View style={styles.groupManageActions}>{currentAdminRole === 'manager' && role === 'subAdmin' && <TouchableOpacity onPress={() => { setAdminManagerOpen(false); setTransferTarget(item); }} style={styles.groupEditButton}><Text style={styles.groupEditButtonText}>권한 승계</Text></TouchableOpacity>}{(isSuperAdmin || role === 'subAdmin') && <TouchableOpacity onPress={() => removeSubAdmin(item)} style={styles.groupDeleteButton}><Text style={styles.groupDeleteButtonText}>권한 삭제</Text></TouchableOpacity>}</View></View>;
              }) : <Text style={styles.managerEmptyText}>등록된 관리자가 없습니다.</Text>}
            </ScrollView>
            <TouchableOpacity onPress={() => setAdminManagerOpen(false)} style={styles.groupManagerClose}><Text style={styles.adminLoginText}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!transferTarget} transparent animationType="fade" onRequestClose={() => setTransferTarget(null)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.adminModalCard}>
            <Text style={styles.adminModalTitle}>그룹관리자 권한 승계</Text>
            <Text style={styles.adminModalDescription}>{transferTarget?.email}에게 그룹관리자 권한을 넘깁니다. 승계 후 본인은 부관리자로 변경됩니다.</Text>
            <TextInput value={transferPassword} onChangeText={setTransferPassword} secureTextEntry placeholder="현재 비밀번호 확인" style={styles.adminInput} />
            <View style={styles.adminModalActions}><TouchableOpacity onPress={() => { setTransferPassword(''); setTransferTarget(null); }} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity><TouchableOpacity disabled={adminBusy} onPress={transferManagerRole} style={styles.adminLoginButton}><Text style={styles.adminLoginText}>{adminBusy ? '승계 중…' : '권한 승계'}</Text></TouchableOpacity></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={groupManagerOpen} transparent animationType="fade" onRequestClose={() => setGroupManagerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.groupManagerCard}>
            <Text style={styles.adminModalTitle}>교회·기관 관리</Text>
            <Text style={styles.adminModalDescription}>이름이 같아도 고유 관리번호로 구별할 수 있습니다.</Text>
            <ScrollView style={styles.groupManagerList}>
              {availableGroups.map((group) => {
                const managementCode = group.managementCode || (group.id === 'gfc' ? 'GFC-BASE' : `ORG-${group.id.slice(0, 6).toUpperCase()}`);
                return <View key={group.id} style={styles.groupManageRow}>
                  <View style={styles.groupManageInfo}><Text style={styles.groupManageName}>{group.name}</Text><Text style={styles.groupManageMeta}>관리번호 {managementCode}</Text><Text style={styles.groupManageMeta}>초대 코드 {group.normalizedInviteCode || '미설정'}</Text>{group.address ? <Text style={styles.groupManageMeta}>주소 {group.address}</Text> : null}{group.description ? <Text style={styles.groupManageDescription} numberOfLines={2}>{group.description}</Text> : null}</View>
                  <View style={styles.groupManageActions}><TouchableOpacity onPress={() => shareGroupInvite(group)} style={styles.groupShareSmallButton}><Text style={styles.groupShareSmallText}>공유</Text></TouchableOpacity><TouchableOpacity onPress={() => openGroupEditor({ ...group, managementCode })} style={styles.groupEditButton}><Text style={styles.groupEditButtonText}>수정</Text></TouchableOpacity><TouchableOpacity onPress={() => removeCommunityGroup(group)} style={styles.groupDeleteButton}><Text style={styles.groupDeleteButtonText}>삭제</Text></TouchableOpacity></View>
                </View>;
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setGroupManagerOpen(false)} style={styles.groupManagerClose}><Text style={styles.adminLoginText}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={groupProfileOpen} transparent animationType="fade" onRequestClose={() => setGroupProfileOpen(false)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
          <ScrollView contentContainerStyle={styles.keyboardModalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.adminModalCard}>
              <Text style={styles.adminModalTitle}>교회·기관 소개</Text>
              <Text style={styles.adminModalDescription}>최고 관리자가 같은 이름의 기관을 구분할 수 있도록 주소와 간단한 소개를 적어 주세요.</Text>
              <TextInput value={groupAddress} onChangeText={setGroupAddress} placeholder="주소 (선택)" style={styles.adminInput} />
              <TextInput value={groupDescription} onChangeText={setGroupDescription} placeholder="간단한 소개 (선택)" multiline textAlignVertical="top" style={[styles.adminInput, styles.groupDescriptionInput]} />
              <View style={styles.adminModalActions}>
                <TouchableOpacity disabled={adminBusy} onPress={() => setGroupProfileOpen(false)} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
                <TouchableOpacity disabled={adminBusy} onPress={saveGroupProfile} style={styles.adminLoginButton}><Text style={styles.adminLoginText}>{adminBusy ? '저장 중…' : '저장'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!editingGroup} transparent animationType="fade" onRequestClose={() => setEditingGroup(null)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
          <ScrollView contentContainerStyle={styles.keyboardModalScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.adminModalCard}>
            <Text style={styles.adminModalTitle}>교회·기관 수정</Text>
            <Text style={styles.managementCodeText}>관리번호 {editingGroup?.managementCode}</Text>
            <TextInput value={editGroupName} onChangeText={setEditGroupName} placeholder="교회·기관 이름" style={styles.adminInput} />
            <TextInput value={editGroupAddress} onChangeText={setEditGroupAddress} placeholder="주소 (선택)" style={styles.adminInput} />
            <TextInput value={editGroupDescription} onChangeText={setEditGroupDescription} placeholder="간단한 소개 (선택)" multiline textAlignVertical="top" style={[styles.adminInput, styles.groupDescriptionInput]} />
            <View style={styles.generatedCodeBox}><Text style={styles.generatedCodeLabel}>초대 코드</Text><Text style={styles.generatedCodeText}>{editGroupCode}</Text></View>
            <TouchableOpacity onPress={() => setEditGroupCode(createInviteCode())} style={styles.regenerateCodeButton}><Text style={styles.regenerateCodeText}>새 초대 코드 만들기</Text></TouchableOpacity>
            <View style={styles.adminModalActions}>
              <TouchableOpacity disabled={adminBusy} onPress={() => setEditingGroup(null)} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
              <TouchableOpacity disabled={adminBusy} onPress={saveGroupChanges} style={styles.adminLoginButton}><Text style={styles.adminLoginText}>{adminBusy ? '저장 중…' : '저장'}</Text></TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={groupPickerOpen} transparent animationType="fade" onRequestClose={() => setGroupPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.adminModalCard}>
            <Text style={styles.adminModalTitle}>공지사항 기관 선택</Text>
            <Text style={styles.adminModalDescription}>가입한 교회·기관을 선택하면 해당 기관의 소식과 중보기도만 표시됩니다.</Text>
            <ScrollView style={styles.groupPickerList}>
              {visibleGroups.map((group) => <TouchableOpacity key={group.id} onPress={() => selectCommunityGroup(group.id)} style={[styles.groupPickerRow, currentGroupId === group.id && styles.groupPickerRowActive]}><Text style={[styles.groupPickerRowText, currentGroupId === group.id && styles.groupPickerRowTextActive]}>{group.name}</Text>{currentGroupId === group.id && <Text style={styles.groupPickerCheck}>✓</Text>}</TouchableOpacity>)}
            </ScrollView>
            <View style={styles.adminModalActions}>
              <TouchableOpacity onPress={() => { setGroupPickerOpen(false); setJoinGroupOpen(true); }} style={styles.registerAdminButtonInline}><Text style={styles.registerAdminButtonText}>＋ 기관 가입</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setGroupPickerOpen(false)} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>닫기</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={adminGroupPickerOpen} transparent animationType="fade" onRequestClose={() => setAdminGroupPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.adminModalCard}>
            <Text style={styles.adminModalTitle}>관리할 교회·기관 선택</Text>
            <Text style={styles.adminModalDescription}>이 선택은 일반 회원 화면의 현재 기관에는 영향을 주지 않습니다.</Text>
            <ScrollView style={styles.groupPickerList}>
              {managedGroups.map((group) => <TouchableOpacity key={group.id} onPress={() => { setAdminGroupId(group.id); setSelectedNoticePost(null); setNoticeCategory(null); setAdminGroupPickerOpen(false); }} style={[styles.groupPickerRow, adminGroupId === group.id && styles.groupPickerRowActive]}>
                <View style={styles.groupManageInfo}><Text style={[styles.groupPickerRowText, adminGroupId === group.id && styles.groupPickerRowTextActive]}>{group.name}</Text>{group.address ? <Text numberOfLines={1} style={styles.groupManageMeta}>주소 · {group.address}</Text> : null}{group.description ? <Text numberOfLines={2} style={styles.groupManageDescription}>소개 · {group.description}</Text> : null}</View>
                {adminGroupId === group.id && <Text style={styles.groupPickerCheck}>✓</Text>}
              </TouchableOpacity>)}
            </ScrollView>
            <TouchableOpacity onPress={() => setAdminGroupPickerOpen(false)} style={styles.groupManagerClose}><Text style={styles.adminLoginText}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={joinGroupOpen} transparent animationType="fade" onRequestClose={() => setJoinGroupOpen(false)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
          <ScrollView contentContainerStyle={styles.keyboardModalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.adminModalCard}>
              <Text style={styles.adminModalTitle}>교회·기관 가입</Text>
              <Text style={styles.adminModalDescription}>교회·기관 관리자에게 받은 초대 코드를 입력해 주세요. 공유받은 안내문 전체를 붙여 넣어도 됩니다.</Text>
              <TextInput value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" autoCorrect={false} placeholder="초대 코드" returnKeyType="done" onSubmitEditing={joinCommunityGroup} style={styles.adminInput} />
              <View style={styles.adminModalActions}>
                <TouchableOpacity disabled={adminBusy} onPress={() => setJoinGroupOpen(false)} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
                <TouchableOpacity disabled={adminBusy} onPress={joinCommunityGroup} style={styles.adminLoginButton}><Text style={styles.adminLoginText}>{adminBusy ? '확인 중…' : '가입'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={createGroupOpen} transparent animationType="fade" onRequestClose={() => setCreateGroupOpen(false)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.adminModalCard}>
            <Text style={styles.adminModalTitle}>새 교회·기관 만들기</Text>
            <Text style={styles.adminModalDescription}>교회·기관 이름만 입력하세요. 안전한 12자리 초대 코드는 앱이 자동으로 만들고 복사합니다.</Text>
            <TextInput value={newGroupName} onChangeText={setNewGroupName} placeholder="교회·기관 이름 (예: 사랑교회)" style={styles.adminInput} />
            <View style={styles.generatedCodeBox}><Text style={styles.generatedCodeLabel}>자동 생성될 초대 코드</Text><Text style={styles.generatedCodeText}>{newGroupCode}</Text></View>
            <View style={styles.adminModalActions}>
              <TouchableOpacity disabled={adminBusy} onPress={() => setCreateGroupOpen(false)} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
              <TouchableOpacity disabled={adminBusy} onPress={createCommunityGroup} style={styles.adminLoginButton}><Text style={styles.adminLoginText}>{adminBusy ? '생성 중…' : '기관 만들기'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={adminLoginOpen} transparent animationType="fade" onRequestClose={() => setAdminLoginOpen(false)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
          <ScrollView contentContainerStyle={styles.keyboardModalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.adminModalCard}>
              <Text style={styles.adminModalTitle}>관리자 로그인</Text>
              <Text style={styles.adminModalDescription}>Firebase에 등록한 관리자 계정으로 로그인하세요.</Text>
              <TextInput value={adminEmail} onChangeText={setAdminEmail} autoCapitalize="none" keyboardType="email-address" placeholder="이메일" returnKeyType="next" style={styles.adminInput} />
              <TextInput value={adminPassword} onChangeText={setAdminPassword} secureTextEntry placeholder="비밀번호" returnKeyType="done" onSubmitEditing={loginAsAdmin} style={styles.adminInput} />
              <View style={styles.adminModalActions}>
                <TouchableOpacity disabled={adminBusy} onPress={() => { setAdminPassword(''); setAdminLoginOpen(false); }} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
                <TouchableOpacity disabled={adminBusy} onPress={loginAsAdmin} style={[styles.adminLoginButton, adminBusy && styles.importBibleButtonDisabled]}><Text style={styles.adminLoginText}>{adminBusy ? '로그인 중…' : '로그인'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={adminRegisterOpen} transparent animationType="fade" onRequestClose={() => setAdminRegisterOpen(false)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
          <ScrollView contentContainerStyle={styles.keyboardModalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.adminModalCard}>
              <Text style={styles.adminModalTitle}>{adminGroupName} {isSuperAdmin ? '그룹관리자' : '부관리자'} 등록</Text>
              <Text style={styles.adminModalDescription}>{isSuperAdmin ? '그룹관리자는 회원과 부관리자까지 관리합니다.' : '부관리자는 게시글 작성·수정·삭제만 담당합니다.'} 이메일과 6자리 이상의 임시 비밀번호를 입력하세요.</Text>
              <TextInput value={newAdminEmail} onChangeText={setNewAdminEmail} autoCapitalize="none" keyboardType="email-address" placeholder="새 관리자 이메일" returnKeyType="next" style={styles.adminInput} />
              <TextInput value={newAdminPassword} onChangeText={setNewAdminPassword} secureTextEntry placeholder="임시 비밀번호 (6자리 이상)" returnKeyType="done" onSubmitEditing={registerNewAdmin} style={styles.adminInput} />
              <View style={styles.adminModalActions}>
                <TouchableOpacity disabled={adminBusy} onPress={() => { setNewAdminPassword(''); setAdminRegisterOpen(false); }} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
                <TouchableOpacity disabled={adminBusy} onPress={registerNewAdmin} style={[styles.adminLoginButton, adminBusy && styles.importBibleButtonDisabled]}><Text style={styles.adminLoginText}>{adminBusy ? '등록 중…' : '관리자 등록'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={passwordChangeOpen} transparent animationType="fade" onRequestClose={() => setPasswordChangeOpen(false)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
          <View style={styles.adminModalCard}>
            <Text style={styles.adminModalTitle}>내 비밀번호 변경</Text>
            <Text style={styles.adminModalDescription}>본인 확인을 위해 현재 비밀번호를 먼저 입력해 주세요.</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TextInput value={currentAdminPassword} onChangeText={setCurrentAdminPassword} secureTextEntry placeholder="현재 비밀번호" style={styles.adminInput} />
              <TextInput value={nextAdminPassword} onChangeText={setNextAdminPassword} secureTextEntry placeholder="새 비밀번호 (6자리 이상)" style={styles.adminInput} />
              <TextInput value={confirmAdminPassword} onChangeText={setConfirmAdminPassword} secureTextEntry placeholder="새 비밀번호 다시 입력" style={styles.adminInput} />
            </ScrollView>
            <View style={styles.adminModalActions}>
              <TouchableOpacity disabled={adminBusy} onPress={() => { setCurrentAdminPassword(''); setNextAdminPassword(''); setConfirmAdminPassword(''); setPasswordChangeOpen(false); }} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
              <TouchableOpacity disabled={adminBusy} onPress={changeAdminPassword} style={[styles.adminLoginButton, adminBusy && styles.importBibleButtonDisabled]}><Text style={styles.adminLoginText}>{adminBusy ? '변경 중…' : '변경'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!postEditor} transparent animationType="slide" onRequestClose={() => setPostEditor(null)}>
        <KeyboardAvoidingView style={styles.keyboardModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
          <View style={styles.postEditorCard}>
            <Text style={styles.adminModalTitle}>{postEditor?.id ? '게시글 수정' : `${postEditor?.category === 'news' ? `${noticeGroupName} 소식` : '중보기도'} 작성`}</Text>
            <ScrollView style={styles.postEditorFields} contentContainerStyle={styles.postEditorFieldsContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TextInput value={postTitle} onChangeText={setPostTitle} placeholder="제목" maxLength={100} style={styles.adminInput} />
              <TextInput value={postBody} onChangeText={setPostBody} placeholder="내용을 입력해 주세요." multiline scrollEnabled textAlignVertical="top" style={[styles.adminInput, styles.postBodyInput]} />
            </ScrollView>
            <View style={styles.adminModalActions}>
              <TouchableOpacity disabled={adminBusy} onPress={() => setPostEditor(null)} style={styles.adminCancelButton}><Text style={styles.adminCancelText}>취소</Text></TouchableOpacity>
              <TouchableOpacity disabled={adminBusy} onPress={saveCommunityPost} style={[styles.adminLoginButton, adminBusy && styles.importBibleButtonDisabled]}><Text style={styles.adminLoginText}>{adminBusy ? '저장 중…' : '저장'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  tabDisabled: { opacity: 0.35 },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { color: '#7A7F87', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  tabTextDisabled: { color: '#A8AAA8' },
  tabTextActive: { color: '#17223B' },
  placeholderScreen: { flex: 1, alignSelf: 'stretch', margin: 22, padding: 24, borderRadius: 22, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  placeholderTitle: { width: '100%', textAlign: 'center', fontSize: 25, fontWeight: '900', color: '#17223B' },
  placeholderText: { width: '100%', marginTop: 10, fontSize: 14, lineHeight: 21, color: '#747C86', textAlign: 'center' },
  noticeMenuScroll: { flex: 1 },
  noticeMenuScreen: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 30, paddingBottom: Platform.OS === 'android' ? 72 : 42, alignItems: 'center' },
  groupSelector: { width: '100%', marginTop: 16, marginBottom: 10, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD7CA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupSelectorName: { flex: 1, color: '#17223B', fontSize: 16, fontWeight: '900' }, groupSelectorHint: { color: '#9A7C43', fontSize: 11, fontWeight: '800' },
  groupSelectorCompact: { alignSelf: 'center', marginBottom: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#EEEAE1' }, groupSelectorCompactText: { color: '#4F5664', fontSize: 12, fontWeight: '900' }, currentGroupLabel: { alignSelf: 'center', marginBottom: 8, color: '#9A7C43', fontSize: 12, fontWeight: '900' },
  noticeMenuButtons: { width: '100%', marginTop: 24, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  noticeMenuButton: { width: '48.5%', minHeight: 265, paddingHorizontal: 11, paddingVertical: 15, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E2D8' },
  noticeMenuHeading: { alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  noticeMenuIcon: { fontSize: 26, marginBottom: 5 },
  noticeMenuTitle: { fontSize: 18, fontWeight: '900', color: '#17223B', textAlign: 'center' },
  noticePreviewList: { minHeight: 130, marginTop: 10, borderTopWidth: 1, borderTopColor: '#EEEAE1', paddingTop: 8 },
  noticePreviewRow: { minHeight: 25, flexDirection: 'row', alignItems: 'center' }, noticePreviewTitle: { flex: 1, fontSize: 11, color: '#4A5363', fontWeight: '700' }, noticePreviewDate: { marginLeft: 4, fontSize: 9, color: '#9A9EA5', fontWeight: '700' }, noticePreviewEmpty: { marginTop: 12, fontSize: 11, color: '#9A9EA5', textAlign: 'center' }, noticeMoreText: { marginTop: 8, color: '#9A7C43', fontSize: 11, fontWeight: '900', textAlign: 'right' },
  noticeMenuDescription: { marginTop: 6, fontSize: 12, lineHeight: 18, color: '#747C86', textAlign: 'center' },
  memberManagementShortcut: { width: '100%', marginTop: 16, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 15, backgroundColor: '#173C70', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
  memberManagementShortcutTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  memberManagementShortcutDescription: { marginTop: 4, color: '#D9E5F5', fontSize: 11, fontWeight: '700' },
  memberManagementShortcutArrow: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  noticeListScreen: { flex: 1, paddingTop: 18 },
  noticeListHeader: { paddingHorizontal: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noticeBackButton: { width: 82, paddingVertical: 8 }, noticeBackText: { color: '#9A7C43', fontSize: 13, fontWeight: '900' },
  noticeListTitle: { flex: 1, textAlign: 'center', fontSize: 21, fontWeight: '900', color: '#17223B' },
  noticeHeaderSpacer: { width: 82 },
  writePostButton: { width: 82, paddingVertical: 9, borderRadius: 11, backgroundColor: '#17223B', alignItems: 'center' }, writePostButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  noticeListContent: { paddingHorizontal: 22, paddingBottom: 100 }, noticeMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }, noticeErrorText: { color: '#A24A4A', textAlign: 'center', fontWeight: '700' },
  noticeDetailScreen: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 100 }, noticeTitleRow: { minHeight: 58, marginBottom: 8, paddingHorizontal: 17, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E5DC', flexDirection: 'row', alignItems: 'center' }, noticeTitleRowText: { flex: 1, fontSize: 15, fontWeight: '800', color: '#283245' }, noticeTitleRowDate: { marginLeft: 8, fontSize: 11, color: '#8D929A', fontWeight: '700' }, noticeTitleArrow: { marginLeft: 8, color: '#9A7C43', fontSize: 24, fontWeight: '700' },
  noticeEmptyCard: { marginTop: 22, padding: 24, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center' }, noticeEmptyTitle: { color: '#17223B', fontSize: 16, fontWeight: '900' },
  noticePostCard: { marginBottom: 12, padding: 18, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E5DC' }, noticePostTitle: { fontSize: 18, lineHeight: 25, fontWeight: '900', color: '#17223B' }, noticePostDate: { marginTop: 5, fontSize: 11, color: '#9A7C43', fontWeight: '700' }, noticePostAuthor: { marginTop: 5, fontSize: 11, color: '#687386', fontWeight: '800' }, noticePostBody: { marginTop: 15, fontSize: 15, lineHeight: 24, color: '#3F4859' },
  noticePostActions: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEEAE1', flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, noticeEditButton: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 10, backgroundColor: '#EEF1F5' }, noticeEditText: { color: '#42526A', fontSize: 12, fontWeight: '900' }, noticeDeleteButton: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F3E8E5' }, noticeDeleteText: { color: '#A04B3C', fontSize: 12, fontWeight: '900' },
  settingsScreen: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 80 },
  settingsSectionGap: { height: 24 },
  settingsTitle: { fontSize: 26, fontWeight: '900', color: '#17223B', marginBottom: 22 },
  settingsSectionTitle: { fontSize: 15, fontWeight: '900', color: '#5F6876', marginBottom: 10 },
  settingsCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E7E2D8' },
  settingsCardTitle: { fontSize: 19, fontWeight: '900', color: '#17223B' },
  settingsDescription: { marginTop: 9, fontSize: 13, lineHeight: 20, color: '#747C86', fontWeight: '600' },
  memberProfileBox: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: '#F4F1E9' }, memberProfileLabel: { color: '#777E88', fontSize: 11, fontWeight: '800' }, memberProfileName: { marginTop: 3, color: '#17223B', fontSize: 18, fontWeight: '900' }, memberProfileMeta: { marginTop: 3, color: '#7A7F87', fontSize: 10, fontWeight: '700' }, nicknameWaitText: { marginTop: 7, color: '#9A7C43', fontSize: 11, fontWeight: '800' }, memberProfileActions: { marginTop: 10, flexDirection: 'row', gap: 8 }, memberProfileButton: { flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center' }, memberProfileButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' }, memberLeaveButton: { flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: '#F3E8E5', alignItems: 'center', justifyContent: 'center' }, memberLeaveButtonText: { color: '#A04B3C', fontSize: 12, fontWeight: '900' },
  importBibleButton: { marginTop: 18, minHeight: 52, borderRadius: 14, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  importBibleButtonDisabled: { opacity: 0.55 },
  importBibleButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  privateImportNotice: { marginTop: 11, fontSize: 11, lineHeight: 17, color: '#8A8170', textAlign: 'center' },
  registeredTranslationsButton: { minHeight: 52, marginTop: 12, paddingHorizontal: 17, borderRadius: 14, backgroundColor: '#EAE8E1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, registeredTranslationsButtonText: { color: '#303B52', fontSize: 14, fontWeight: '900' }, registeredTranslationsArrow: { color: '#777E88', fontSize: 12, fontWeight: '900' },
  importedList: { marginTop: 24 },
  importedBibleRow: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 9, backgroundColor: '#FFF', borderRadius: 15, borderWidth: 1, borderColor: '#E7E2D8', flexDirection: 'row', alignItems: 'center' },
  importedBibleInfo: { flex: 1 },
  importedBibleName: { fontSize: 15, fontWeight: '900', color: '#17223B' },
  importedBibleMeta: { marginTop: 4, fontSize: 11, color: '#7A7F87', fontWeight: '700' },
  importedBibleDelete: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F3E8E5' },
  importedBibleDeleteText: { color: '#A04B3C', fontSize: 12, fontWeight: '900' },
  adminSettingsBlock: { marginTop: 28 }, adminLogoutButton: { backgroundColor: '#6E7580' }, registerAdminButton: { marginTop: 10, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#173C70', alignItems: 'center', justifyContent: 'center' }, registerAdminButtonText: { color: '#173C70', fontSize: 14, fontWeight: '900' },
  changePasswordButton: { marginTop: 10, minHeight: 48, borderRadius: 14, backgroundColor: '#E8EEF6', alignItems: 'center', justifyContent: 'center' }, changePasswordButtonText: { color: '#173C70', fontSize: 14, fontWeight: '900' },
  superAdminButton: { marginTop: 10, minHeight: 48, borderRadius: 14, backgroundColor: '#9A7C43', alignItems: 'center', justifyContent: 'center' }, superAdminButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  groupManageButton: { marginTop: 10, minHeight: 48, borderRadius: 14, backgroundColor: '#EEEAE1', alignItems: 'center', justifyContent: 'center' }, groupManageButtonText: { color: '#655332', fontSize: 14, fontWeight: '900' },
  shareInviteButton: { marginTop: 10, minHeight: 48, borderRadius: 14, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center' }, shareInviteButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  adminModalCard: { width: '100%', paddingHorizontal: 22, paddingTop: 25, paddingBottom: Platform.OS === 'android' ? 40 : 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F7F6F1' },
  groupManagerCard: { width: '100%', height: '78%', paddingHorizontal: 20, paddingTop: 25, paddingBottom: Platform.OS === 'android' ? 42 : 25, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F7F6F1' }, groupManagerList: { flex: 1 },
  groupManageRow: { marginBottom: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#E2DDD2', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, groupManageInfo: { flex: 1 }, groupManageName: { color: '#17223B', fontSize: 16, fontWeight: '900' }, groupManageMeta: { marginTop: 3, color: '#7A7F87', fontSize: 10, fontWeight: '700' }, groupManageDescription: { marginTop: 6, color: '#525B69', fontSize: 11, lineHeight: 16, fontWeight: '700' }, groupManageActions: { marginLeft: 8, gap: 6 }, groupShareSmallButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9, backgroundColor: '#E8F2EC' }, groupShareSmallText: { color: '#296044', fontSize: 11, fontWeight: '900' }, groupEditButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9, backgroundColor: '#E8EEF6' }, groupEditButtonText: { color: '#173C70', fontSize: 11, fontWeight: '900' }, groupDeleteButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9, backgroundColor: '#F3E8E5' }, groupDeleteButtonText: { color: '#A04B3C', fontSize: 11, fontWeight: '900' }, groupManagerClose: { marginTop: 10, minHeight: 46, borderRadius: 13, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center' },
  adminManageRow: { marginBottom: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#E2DDD2', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, adminRoleText: { alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', backgroundColor: '#EEEAE1', color: '#765F34', fontSize: 10, fontWeight: '900' }, managerEmptyText: { marginTop: 30, color: '#8A8F97', textAlign: 'center', fontWeight: '700' },
  managementCodeText: { marginBottom: 8, color: '#9A7C43', fontSize: 12, fontWeight: '900' }, regenerateCodeButton: { marginTop: 9, alignSelf: 'center', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#173C70' }, regenerateCodeText: { color: '#173C70', fontSize: 12, fontWeight: '900' },
  keyboardModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end' },
  keyboardModalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  postEditorCard: { width: '100%', height: '78%', paddingHorizontal: 22, paddingTop: 25, paddingBottom: Platform.OS === 'android' ? 52 : 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F7F6F1' },
  postEditorFields: { flex: 1 }, postEditorFieldsContent: { flexGrow: 1, paddingBottom: 8 },
  adminModalTitle: { fontSize: 22, fontWeight: '900', color: '#17223B', marginBottom: 8 }, adminModalDescription: { fontSize: 13, lineHeight: 19, color: '#747C86', marginBottom: 14 },
  groupPickerList: { maxHeight: 330, marginTop: 4 }, groupPickerRow: { minHeight: 52, marginBottom: 7, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DED9CE', flexDirection: 'row', alignItems: 'center' }, groupPickerRowActive: { backgroundColor: '#EAF2FF', borderColor: '#90B8EC' }, groupPickerRowText: { flex: 1, color: '#3F4859', fontSize: 15, fontWeight: '800' }, groupPickerRowTextActive: { color: '#173C70' }, groupPickerCheck: { color: '#276DB5', fontSize: 18, fontWeight: '900' }, registerAdminButtonInline: { minWidth: 110, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#173C70', alignItems: 'center' },
  generatedCodeBox: { marginTop: 12, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 13, backgroundColor: '#EEEAE1', alignItems: 'center' }, generatedCodeLabel: { color: '#777E88', fontSize: 11, fontWeight: '800' }, generatedCodeText: { marginTop: 5, color: '#17223B', fontSize: 19, letterSpacing: 2, fontWeight: '900' },
  adminInput: { minHeight: 52, marginTop: 10, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: '#DED9CE', backgroundColor: '#FFF', color: '#17223B', fontSize: 15 }, postBodyInput: { minHeight: 220, flexGrow: 1 },
  groupDescriptionInput: { minHeight: 110, maxHeight: 180 },
  adminModalActions: { marginTop: 18, flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }, adminCancelButton: { minWidth: 82, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, backgroundColor: '#E8E5DE', alignItems: 'center' }, adminCancelText: { color: '#626A75', fontWeight: '900' }, adminLoginButton: { minWidth: 100, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, backgroundColor: '#173C70', alignItems: 'center' }, adminLoginText: { color: '#FFF', fontWeight: '900' },
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
  listContent: { paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 90 : 40, paddingBottom: 120 }, recordCard: { backgroundColor: '#FFF', borderRadius: 17, padding: 16, marginBottom: 10 }, recordCardCanceled: { backgroundColor: '#F2F1ED' }, recordTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, recordDay: { fontSize: 14, fontWeight: '900', color: '#17223B' }, recordStatus: { fontSize: 11, fontWeight: '900', color: '#8B6B35' }, canceledStatus: { color: '#9A9A95' }, recordStage: { fontSize: 11, color: '#838993', marginBottom: 4 }, recordReading: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: '#303B52' }, recordDate: { fontSize: 11, lineHeight: 17, fontWeight: '700', color: '#9A7C43' }, mutedText: { color: '#A8AAA8' }, cancelDate: { marginTop: 3, fontSize: 11, color: '#A8AAA8', fontWeight: '700' }, dateHistoryBox: { marginTop: 9 }, recordActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }, cancelButton: { borderWidth: 1, borderColor: '#D8CFC2', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 }, cancelButtonText: { fontSize: 12, fontWeight: '900', color: '#7F6750' }, readAgainButton: { backgroundColor: '#17223B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, readAgainButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' }, emptyCard: { marginTop: 24, backgroundColor: '#FFF', borderRadius: 16, padding: 22, alignItems: 'center' }, emptyText: { color: '#777', fontWeight: '700' },
  bibleHeader: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E8E4DA', gap: 8 }, backButton: { paddingVertical: 8, paddingRight: 6 }, backText: { fontSize: 15, fontWeight: '900', color: '#9A7C43' }, bibleTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#17223B' }, homeButton: { backgroundColor: '#17223B', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, homeButtonText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  readerTools: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF' }, translationButton: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F5F1E8' }, translationText: { fontWeight: '900', color: '#17223B' }, fontTools: { flexDirection: 'row', gap: 8 }, fontButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#17223B' }, fontButtonText: { color: '#FFF', fontWeight: '900' },
  readerContent: { padding: 20, paddingBottom: 40 }, readerRange: { fontSize: 21, lineHeight: 31, fontWeight: '900', color: '#17223B', marginBottom: 20 }, section: { marginBottom: 18 }, chapterHeading: { fontSize: 19, fontWeight: '900', color: '#17223B', marginTop: 18, marginBottom: 8 }, verseText: { color: '#2E374A', marginBottom: 10 }, verseNumber: { fontWeight: '900', color: '#9A7C43' }, missingText: { color: '#A24A4A', fontWeight: '700' }, sourceBox: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#F0EEE7' }, sourceText: { fontSize: 11, lineHeight: 17, color: '#6B6F75' }, targetVerseWrap: { borderRadius: 8, paddingHorizontal: 4 },
  fixedChapterHeader: { paddingHorizontal: 18, paddingVertical: 11, backgroundColor: '#FFFEFB', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E3DED2', alignItems: 'center' }, fixedChapterHeaderText: { color: '#17223B', fontSize: 19, fontWeight: '900' },
  chapterNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 48 : 16, backgroundColor: '#F7F6F1', borderTopWidth: 1, borderTopColor: '#E3DED2', elevation: 8 }, chapterNavButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#173C70', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, chapterNavButtonText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, chapterNavCurrent: { minWidth: 88, textAlign: 'center', color: '#17223B', fontSize: 13, fontWeight: '900' },
  indexWrap: { padding: 22, paddingBottom: 45 }, indexHeaderRow: { width: '94%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }, indexLabel: { fontSize: 15, fontWeight: '900', color: '#17223B', marginTop: 18, marginBottom: 10 }, bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, bookChip: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: '#ECEAE4' }, bookChipActive: { backgroundColor: '#17223B' }, bookChipText: { color: '#5D6470', fontWeight: '800', fontSize: 12 }, bookChipTextActive: { color: '#FFF' }, numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, numberChip: { width: 43, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#ECEAE4' }, numberChipActive: { backgroundColor: '#B28A48' }, numberChipText: { fontWeight: '900', color: '#5D6470' }, numberChipTextActive: { color: '#FFF' }, indexHint: { marginTop: 10, textAlign: 'center', fontSize: 11, lineHeight: 17, color: '#777' },
  dropdownButton: { marginBottom: 10, borderWidth: 1, borderColor: '#DED9CE', borderRadius: 14, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dropdownLabel: { fontSize: 13, fontWeight: '800', color: '#777E88' }, dropdownValue: { fontSize: 16, fontWeight: '900', color: '#17223B' },
  translationPickerCard: { width: '100%', maxHeight: '70%', backgroundColor: '#F7F6F1', borderRadius: 22, overflow: 'hidden' },
  translationPickerList: { padding: 13, paddingBottom: 20 },
  translationPickerRow: { minHeight: 64, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  translationPickerRowActive: { backgroundColor: '#17223B' },
  translationPickerName: { fontSize: 16, fontWeight: '900', color: '#283245' },
  translationPickerNameActive: { color: '#FFF' },
  translationPickerMeta: { marginTop: 4, fontSize: 11, fontWeight: '700', color: '#858B94' },
  translationPickerMetaActive: { color: '#D9DEE8' },
  translationPickerCheck: { width: 28, textAlign: 'center', fontSize: 20, fontWeight: '900', color: '#B28A48' },
  translationPickerCheckActive: { color: '#E6C77F' },
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
  homologiaViewSwitch: { flexDirection: 'row', alignSelf: 'center', marginVertical: 9, padding: 3, borderRadius: 12, backgroundColor: '#E7E2D7' },
  homologiaViewButton: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  homologiaViewButtonActive: { backgroundColor: '#17223B' },
  homologiaViewButtonText: { color: '#777D87', fontSize: 13, fontWeight: '900' },
  homologiaViewButtonTextActive: { color: '#FFF' },
  homologiaVideoLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 9 },
  homologiaVideoLinkButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: '#F0E8D7', borderWidth: 1, borderColor: '#D8C9A8' },
  homologiaVideoLinkText: { color: '#6C531F', fontSize: 11, fontWeight: '900' },
  homologiaPdf: { flex: 1, width: '100%', backgroundColor: '#C9C7C1' },
  homologiaPages: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: Platform.OS === 'android' ? 80 : 40, backgroundColor: '#FFFEFB' },
  homologiaPage: { backgroundColor: '#FFFEFB', borderRadius: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 22, marginBottom: 14, borderWidth: 1, borderColor: '#E5DECF' },
  homologiaPageNumber: { alignSelf: 'flex-end', color: '#9B9487', fontSize: 10, marginBottom: 2 },
  homologiaTextBlock: { width: '100%', borderRadius: 2 },
  homologiaBoxImageWrap: { width: '100%', alignItems: 'center' }, homologiaBoxImage: { width: '100%', borderRadius: 2 },
  noteModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 }, postIt: { width: '100%', backgroundColor: '#FFF2A8', borderRadius: 18, padding: 20, elevation: 8 }, postItTitle: { fontSize: 20, fontWeight: '900', color: '#554716' }, postItVerse: { marginTop: 5, marginBottom: 13, color: '#786725', fontWeight: '800' }, noteInput: { minHeight: 170, textAlignVertical: 'top', backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 12, padding: 14, color: '#413913', fontSize: 16, lineHeight: 24 }, noteButtons: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, noteRightButtons: { flexDirection: 'row', gap: 8 }, noteDelete: { paddingHorizontal: 12, paddingVertical: 10 }, noteDeleteText: { color: '#A04B3C', fontWeight: '900' }, noteCancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#E8D989' }, noteCancelText: { color: '#5A4D1E', fontWeight: '900' }, noteSave: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#17223B' }, noteSaveText: { color: '#FFF', fontWeight: '900' },

  celebrateBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', padding: 20 }, celebrateCard: { width: '100%', backgroundColor: '#FFFEFB', borderRadius: 24, padding: 22, alignItems: 'center' }, confetti: { fontSize: 30, marginBottom: 4 }, celebrateTitle: { fontSize: 30, fontWeight: '900', color: '#17223B', marginBottom: 18 }, celebrateSummary: { width: '100%', backgroundColor: '#FBF7EF', borderWidth: 1, borderColor: '#EADDBE', borderRadius: 18, padding: 18 }, celebrateSmall: { fontSize: 13, fontWeight: '800', color: '#747C86', marginBottom: 8 }, celebrateDayBadge: { alignSelf: 'flex-start', backgroundColor: '#17223B', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 }, celebrateDayText: { color: '#FFF', fontWeight: '900' }, celebrateStage: { fontSize: 16, lineHeight: 23, fontWeight: '900', color: '#8B6B35' }, celebrateDivider: { height: 1, backgroundColor: '#E8DDC6', marginVertical: 14 }, celebrateReading: { fontSize: 23, lineHeight: 32, fontWeight: '900', color: '#17223B' }, celebrateSuccess: { marginTop: 18, fontSize: 19, lineHeight: 28, fontWeight: '900', color: '#17223B', textAlign: 'center' }, finalCongrats: { marginTop: 8, fontSize: 13, lineHeight: 20, color: '#8B6B35', fontWeight: '800', textAlign: 'center' }, celebrateButton: { width: '100%', marginTop: 18, backgroundColor: '#173C70', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }, celebrateButtonText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
});
