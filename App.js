import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import schedule from './assets/schedule.json';

const CURRENT_DAY_KEY = '@chronological_bible/current_day';
const COMPLETIONS_KEY = '@chronological_bible/completions';

const formatKoreanDateTime = (date = new Date()) => {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
  }
};

export default function App() {
  const [screen, setScreen] = useState('today');
  const [currentDay, setCurrentDay] = useState(1);
  const [completions, setCompletions] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [[, savedDay], [, savedCompletions]] = await AsyncStorage.multiGet([
          CURRENT_DAY_KEY,
          COMPLETIONS_KEY,
        ]);

        const parsedDay = Number(savedDay || 1);
        setCurrentDay(Number.isFinite(parsedDay) && parsedDay >= 1 && parsedDay <= 365 ? parsedDay : 1);
        setCompletions(savedCompletions ? JSON.parse(savedCompletions) : {});
      } catch (error) {
        Alert.alert('저장 정보 확인', '저장된 진행 정보를 불러오지 못했습니다. Day 001부터 표시합니다.');
      } finally {
        setLoaded(true);
      }
    };

    load();
  }, []);

  const current = schedule[currentDay - 1];
  const completedCount = Object.keys(completions).length;
  const isCurrentCompleted = Boolean(completions[String(currentDay)]);
  const isAllDone = completedCount >= schedule.length;
  const progress = completedCount / schedule.length;

  const completedRows = useMemo(
    () =>
      schedule
        .filter((item) => completions[String(item.day)])
        .map((item) => ({ ...item, completedAt: completions[String(item.day)] })),
    [completions]
  );

  const completeToday = async () => {
    if (!current || isAllDone) return;

    const key = String(current.day);
    if (completions[key]) return;

    const completedAt = formatKoreanDateTime(new Date());
    const nextCompletions = { ...completions, [key]: completedAt };
    const nextDay = current.day < schedule.length ? current.day + 1 : current.day;

    try {
      await AsyncStorage.multiSet([
        [COMPLETIONS_KEY, JSON.stringify(nextCompletions)],
        [CURRENT_DAY_KEY, String(nextDay)],
      ]);
      setCompletions(nextCompletions);
      setCurrentDay(nextDay);

      if (current.day === schedule.length) {
        Alert.alert('통독 완료', '365일 연대기별 성경통독 일정을 모두 완료했습니다.');
      }
    } catch (error) {
      Alert.alert('저장 실패', '완료 기록을 저장하지 못했습니다. 다시 눌러 주세요.');
    }
  };

  const exitApp = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }
    Alert.alert('종료 안내', 'iPhone에서는 앱이 스스로 종료될 수 없습니다. 홈 화면으로 이동하면 진행 상태는 그대로 저장됩니다.');
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>일정을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>365-DAY BIBLE READING</Text>
            <Text style={styles.title}>연대기별 성경통독 일정표</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={exitApp} style={styles.exitButton}>
            <Text style={styles.exitButtonText}>종료</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setScreen('today')}
            style={[styles.tab, screen === 'today' && styles.tabActive]}
          >
            <Text style={[styles.tabText, screen === 'today' && styles.tabTextActive]}>오늘 일정</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setScreen('records')}
            style={[styles.tab, screen === 'records' && styles.tabActive]}
          >
            <Text style={[styles.tabText, screen === 'records' && styles.tabTextActive]}>완료 기록</Text>
          </TouchableOpacity>
        </View>

        {screen === 'today' ? (
          <View style={styles.content}>
            <View style={styles.progressBlock}>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>통독 진행률</Text>
                <Text style={styles.progressValue}>{completedCount} / 365</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
              </View>
            </View>

            {isAllDone ? (
              <View style={styles.finishCard}>
                <Text style={styles.finishIcon}>✓</Text>
                <Text style={styles.finishTitle}>365일 통독 완료</Text>
                <Text style={styles.finishBody}>모든 일정이 완료 기록에 저장되어 있습니다.</Text>
                <TouchableOpacity onPress={() => setScreen('records')} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>완료 기록 보기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>{current.dayLabel}</Text>
                </View>

                <Text style={styles.stage}>{current.stage}</Text>
                <View style={styles.divider} />
                <Text style={styles.readingLabel}>오늘 읽을 말씀</Text>
                <Text style={styles.reading}>{current.reading}</Text>

                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>완료를 눌러야 다음 Day로 넘어갑니다. 종료만 하면 이 일정이 그대로 유지됩니다.</Text>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={completeToday}
                  disabled={isCurrentCompleted}
                  style={[styles.completeButton, isCurrentCompleted && styles.buttonDisabled]}
                >
                  <Text style={styles.completeButtonText}>✓ 오늘 통독 완료</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.recordsWrap}>
            <View style={styles.recordsHeader}>
              <View>
                <Text style={styles.recordsTitle}>완료 기록</Text>
                <Text style={styles.recordsSubtitle}>완료한 날짜와 읽기 범위를 확인할 수 있습니다.</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{completedCount}일</Text>
              </View>
            </View>

            {completedRows.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>○</Text>
                <Text style={styles.emptyTitle}>아직 완료 기록이 없습니다.</Text>
                <Text style={styles.emptyBody}>Day 001을 완료하면 여기에 완료일자가 표시됩니다.</Text>
              </View>
            ) : (
              <FlatList
                data={completedRows}
                keyExtractor={(item) => String(item.day)}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.recordCard}>
                    <View style={styles.recordTopRow}>
                      <Text style={styles.recordDay}>{item.dayLabel}</Text>
                      <Text style={styles.recordDate}>{item.completedAt}</Text>
                    </View>
                    <Text style={styles.recordStage}>{item.stage}</Text>
                    <Text style={styles.recordReading}>{item.reading}</Text>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F6F1' },
  app: { flex: 1, backgroundColor: '#F7F6F1' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: '#5C6573' },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: '800', color: '#9A7C43', marginBottom: 5 },
  title: { fontSize: 22, lineHeight: 29, fontWeight: '900', color: '#17223B' },
  exitButton: { borderWidth: 1, borderColor: '#D6D2C8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#FFFFFF' },
  exitButtonText: { color: '#5B6471', fontWeight: '800', fontSize: 13 },
  tabs: { marginHorizontal: 22, flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: '#EAE8E1' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#7A7F87', fontWeight: '800', fontSize: 14 },
  tabTextActive: { color: '#17223B' },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 22 },
  progressBlock: { marginBottom: 18 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: '800', color: '#626A75' },
  progressValue: { fontSize: 13, fontWeight: '900', color: '#17223B' },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#E3E0D7', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#B28A48' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#ECE8DE' },
  dayBadge: { alignSelf: 'flex-start', backgroundColor: '#17223B', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 16 },
  dayBadgeText: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.4 },
  stage: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: '#9A7C43' },
  divider: { height: 1, backgroundColor: '#EEEAE1', marginVertical: 18 },
  readingLabel: { fontSize: 13, fontWeight: '800', color: '#747C86', marginBottom: 8 },
  reading: { fontSize: 25, lineHeight: 36, fontWeight: '900', color: '#17223B', letterSpacing: -0.5 },
  noteBox: { marginTop: 24, padding: 14, borderRadius: 14, backgroundColor: '#F6F1E7' },
  noteText: { fontSize: 12, lineHeight: 18, color: '#6E675B', fontWeight: '600' },
  completeButton: { marginTop: 18, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#B28A48' },
  completeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  buttonDisabled: { opacity: 0.5 },
  finishCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#ECE8DE' },
  finishIcon: { fontSize: 42, color: '#B28A48', fontWeight: '900', marginBottom: 8 },
  finishTitle: { fontSize: 23, fontWeight: '900', color: '#17223B', marginBottom: 8 },
  finishBody: { fontSize: 14, color: '#69717D', marginBottom: 20 },
  secondaryButton: { backgroundColor: '#17223B', paddingVertical: 13, paddingHorizontal: 22, borderRadius: 14 },
  secondaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  recordsWrap: { flex: 1, paddingTop: 22 },
  recordsHeader: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  recordsTitle: { fontSize: 21, fontWeight: '900', color: '#17223B' },
  recordsSubtitle: { fontSize: 12, lineHeight: 18, color: '#747C86', marginTop: 3 },
  countPill: { backgroundColor: '#F0E7D6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 },
  countPillText: { color: '#8B6B35', fontWeight: '900' },
  listContent: { paddingHorizontal: 22, paddingBottom: 28 },
  recordCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#ECE8DE' },
  recordTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  recordDay: { fontSize: 14, fontWeight: '900', color: '#17223B' },
  recordDate: { fontSize: 11, fontWeight: '800', color: '#9A7C43' },
  recordStage: { fontSize: 11, color: '#838993', marginBottom: 4 },
  recordReading: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: '#303B52' },
  emptyState: { marginHorizontal: 22, marginTop: 50, alignItems: 'center', padding: 26 },
  emptyIcon: { fontSize: 38, color: '#B28A48', marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: '#17223B', marginBottom: 7 },
  emptyBody: { textAlign: 'center', fontSize: 13, lineHeight: 20, color: '#747C86' },
});
