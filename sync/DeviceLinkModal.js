import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
const MODES = [
  ['merge', '두 기기의 기록 합치기 · 추천', '같은 항목이 다르면 나중에 수정한 내용을 적용합니다.'],
  ['source', '코드를 만든 기기의 기록으로 맞추기', '이 기기의 기존 기록을 바꿉니다.'],
  ['receiver', '이 기기의 기록으로 맞추기', '코드를 만든 기기와 연결된 기기들의 기록을 바꿉니다.'],
];
export const syncStatusText = status => ({ unlinked: '다른 기기와 기록 이어보기', pending: '기기에 저장됨 · 전송 대기', syncing: '기록 동기화 중', synced: '동기화 완료', error: '동기화 준비를 확인해 주세요' }[status] || '다른 기기와 기록 이어보기');
function friendlyError(error) {
  if (/not-found/.test(error?.code || '')) return '코드가 만료되었거나 올바르지 않습니다. 새 코드를 받아 주세요.';
  if (/unavailable|deadline-exceeded/.test(error?.code || '')) return '인터넷 연결을 확인해 주세요. 기록은 기기에 보관되어 있습니다.';
  if (/internal/.test(error?.code || '')) return '연결 서버를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  return error?.message || '기기 연결을 완료하지 못했습니다. 다시 시도해 주세요.';
}
export default function DeviceLinkModal({ visible, onClose, service, status }) {
  const [page, setPage] = useState('start'); const [busy, setBusy] = useState(false);
  const [name, setName] = useState('내 기기'); const [code, setCode] = useState('');
  const [generated, setGenerated] = useState(null); const [link, setLink] = useState(null);
  const [mode, setMode] = useState('merge'); const [devices, setDevices] = useState([]); const [clock, setClock] = useState(Date.now());
  useEffect(() => { if (visible) { setPage('start'); setCode(''); setLink(null); setGenerated(null); setMode('merge'); if (status.profileId && service) service.listDevices().then(r => setDevices(r.devices)).catch(() => {}); } }, [visible]);
  useEffect(() => { if (!visible || page !== 'code') return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [visible, page]);
  useEffect(() => { if (visible && page === 'code' && generated && status.deviceCount > generated.deviceCount) { setPage('done'); service?.listDevices().then(r => setDevices(r.devices)).catch(() => {}); } }, [visible, page, generated, status.deviceCount]);
  const seconds = Math.max(0, Math.ceil(((generated?.expiresAt || 0) - clock - (generated?.offset || 0)) / 1000));
  const run = async work => {
    if (busy) return;
    if (!service) { Alert.alert('연결 준비 중', '사용자 인증을 준비하고 있습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'); return; }
    setBusy(true); try { await work(); } catch (error) { Alert.alert('기기 연결', friendlyError(error)); } finally { setBusy(false); }
  };
  const create = () => run(async () => { const r = await service.createCode(name); setClock(Date.now()); setGenerated({ ...r, offset: r.serverTime - Date.now() }); setPage('code'); });
  const prepare = () => run(async () => { const r = await service.prepare(code, name); setLink(r); setMode('merge'); setPage('choose'); });
  const finish = () => run(async () => { await service.finish(link, mode); setDevices((await service.listDevices()).devices); setPage('done'); });
  const button = (title, onPress, primary = false) => <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onPress} style={[s.button, primary && s.primary, busy && s.disabled]}><Text style={[s.buttonText, primary && s.primaryText]}>{busy && primary ? '처리 중…' : title}</Text></TouchableOpacity>;
  const back = target => button('‹ 이전', () => setPage(target));
  return <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}><Text style={s.brand}>GF Bible · 기기 연결</Text><TouchableOpacity disabled={busy} onPress={onClose} accessibilityRole="button" style={s.close}><Text style={s.buttonText}>닫기</Text></TouchableOpacity></View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {page === 'start' && <>
          <Text style={s.title}>다른 기기에서 기록 이어보기</Text><Text style={s.description}>핸드폰·태블릿 어느 쪽에서 시작해도 됩니다.</Text>
          <Text style={s.label}>이 기기의 이름</Text><TextInput accessibilityLabel="이 기기의 이름" value={name} onChangeText={setName} maxLength={50} placeholder="예: 내 핸드폰, 내 태블릿" style={s.input} />
          {button('연결 코드 만들기', create, true)}<Text style={s.hint}>다른 기기에서 입력할 코드를 표시합니다.</Text>
          {button('연결 코드 입력', () => setPage('enter'))}<Text style={s.hint}>다른 기기에 표시된 코드를 입력합니다.</Text>
          <Text style={s.description}>연결을 시작하면 읽기 기록·형광펜·북마크·메모를 서버에 보관합니다. 개인 성경 본문 파일은 전송하지 않습니다.</Text>
          {status.profileId && <View style={s.box}><Text style={s.label}>{syncStatusText(status.status)}</Text>{devices.map(d => <Text style={s.description} key={d.id}>{d.name}{d.current ? ' · 현재 기기' : ''}</Text>)}{button('동기화 다시 확인', () => run(async () => { await service.sync(); setDevices((await service.listDevices()).devices); }))}{button('연결 전 기록 복구', () => Alert.alert('기록 복구', '가장 최근 복구용 사본으로 기록을 바꿉니다. 복구한 기록은 연결된 모든 기기에도 반영됩니다.', [{ text: '취소', style: 'cancel' }, { text: '복구', onPress: () => run(() => service.restore()) }]))}</View>}
        </>}
        {page === 'code' && <>{back('start')}<Text style={s.title}>다른 기기에서 입력하세요</Text><View style={s.box}><Text selectable style={s.code}>{generated?.code?.slice(0, 3)} {generated?.code?.slice(3)}</Text><Text style={s.hint}>{seconds ? `남은 시간 ${Math.floor(seconds / 60)}분 ${String(seconds % 60).padStart(2, '0')}초` : '코드가 만료되었습니다.'}</Text></View><Text style={s.description}>다른 기기에서 더보기 → 기기 연결 → 연결 코드 입력을 선택하세요.</Text><Text style={s.description}>연결이 끝나면 이 코드는 즉시 만료됩니다.</Text>{button('새 코드 만들기', create, !seconds)}{button('연결 상태 확인', () => run(async () => { const r = await service.listDevices(); setDevices(r.devices); if (r.devices.length > generated.deviceCount) setPage('done'); else Alert.alert('연결 대기', '다른 기기에서 코드 입력과 기록 선택을 완료해 주세요.'); }))}</>}
        {page === 'enter' && <>{back('start')}<Text style={s.title}>연결 코드 입력</Text><Text style={s.description}>다른 기기에 표시된 숫자 6자리를 입력하세요.</Text><TextInput accessibilityLabel="6자리 연결 코드" value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="482719" style={s.input} />{button('다음', prepare, true)}</>}
        {page === 'choose' && <>{back('enter')}<Text style={s.title}>어떤 기록으로 시작할까요?</Text><Text style={s.description}>코드를 만든 기기: {link?.sourceName}{'\n'}이 기기: {link?.receiverName}</Text>{MODES.map(([value, title, detail]) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }} disabled={busy} onPress={() => setMode(value)} style={[s.choice, mode === value && s.selected]}><Text style={s.label}>{mode === value ? '●' : '○'} {title}</Text><Text style={s.hint}>{detail}</Text></TouchableOpacity>)}<Text style={s.hint}>기존 메모처럼 수정 시간이 없는 기록은 어느 것이 최신인지 알 수 없습니다. 겹치는 기록은 한쪽을 적용하고 원본 사본은 보관합니다.</Text>{button('선택한 방식으로 계속', () => setPage('confirm'), true)}</>}
        {page === 'confirm' && <>{back('choose')}<Text style={s.title}>연결 내용을 확인하세요</Text><View style={s.box}><Text style={s.label}>{MODES.find(m => m[0] === mode)?.[1]}</Text><Text style={s.description}>{MODES.find(m => m[0] === mode)?.[2]}</Text></View><Text style={s.description}>적용 전 기존 기록을 복구용 사본으로 보관합니다. 이후 두 기기의 변경 기록은 자동으로 동기화됩니다.</Text><Text style={s.hint}>구입한 성경 본문은 각 기기에 별도로 불러와 주세요.</Text>{button('확인하고 연결하기', finish, true)}</>}
        {page === 'done' && <><Text style={s.title}>✓ 기기 연결 완료</Text><Text style={s.description}>연결된 기기에서 기록을 이어서 사용할 수 있습니다.</Text><View style={s.box}><Text style={s.label}>{syncStatusText(status.status)}</Text>{devices.map(d => <Text key={d.id} style={s.description}>{d.name}{d.current ? ' · 현재 기기' : ''}</Text>)}</View><Text style={s.description}>인터넷 없이 사용한 기록은 기기에 먼저 저장합니다. 다시 연결되면 자동으로 전송합니다.</Text>{button('완료', onClose, true)}</>}
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF7F0', paddingTop: Platform.OS === 'android' ? 30 : 54 },
  header: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E4DFD6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 19, fontWeight: '700', color: '#24334B', flexShrink: 1 }, close: { padding: 12 },
  content: { padding: 22, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 40 },
  title: { fontSize: 23, fontWeight: '700', color: '#24334B', marginVertical: 18 }, description: { fontSize: 15, lineHeight: 25, color: '#514C43', marginVertical: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#24334B' }, hint: { fontSize: 13, lineHeight: 21, color: '#716B61', marginTop: 8 },
  button: { minHeight: 48, borderWidth: 1, borderColor: '#D8D0C3', backgroundColor: '#FFFDF8', padding: 14, borderRadius: 12, marginTop: 14, alignItems: 'center' },
  buttonText: { fontSize: 16, color: '#816027', fontWeight: '600' }, primary: { backgroundColor: '#A57A36', borderColor: '#A57A36' }, primaryText: { color: '#FFFFFF' }, disabled: { opacity: 0.55 },
  input: { borderWidth: 1, borderColor: '#D8D0C3', borderRadius: 10, backgroundColor: '#FFFDF8', color: '#24334B', fontSize: 18, padding: 14, marginTop: 12 },
  box: { borderWidth: 1, borderColor: '#E5DED1', padding: 18, borderRadius: 14, backgroundColor: '#FFFDF8', marginVertical: 18 },
  code: { fontSize: 36, letterSpacing: 4, fontWeight: '700', color: '#24334B', textAlign: 'center', marginVertical: 16 },
  choice: { borderWidth: 1, borderColor: '#D8D0C3', padding: 16, borderRadius: 12, marginTop: 12, backgroundColor: '#FFFDF8' }, selected: { borderColor: '#A57A36', backgroundColor: '#F4EAD6' },
});
