import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
const { PersonalSyncEngine } = require('./personal-sync-engine');
const { isTrackedKey } = require('../functions/device-sync-core');
let currentEngine = null;
// Existing local storage continues to work without opting in or connecting to a server.
export const syncStorage = {
  async setItem(key, value, previous) {
    if (currentEngine && isTrackedKey(key)) return currentEngine.write([[key, value]], previous === undefined ? {} : { [key]: previous });
    return AsyncStorage.setItem(key, value);
  },
  async multiSet(rows, basis = {}) {
    const tracked = rows.filter(([key]) => isTrackedKey(key));
    const other = rows.filter(([key]) => !isTrackedKey(key));
    if (tracked.length) {
      if (currentEngine) await currentEngine.write(tracked, basis);
      else await AsyncStorage.multiSet(tracked);
    }
    if (other.length) await AsyncStorage.multiSet(other);
  },
};
export function startPersonalSync({ uid, functions, firestore, onApply, onStatus }) {
  const call = async (name, payload) => (await httpsCallable(functions, name, { timeout: 20000 })(payload)).data;
  const engine = new PersonalSyncEngine({ storage: AsyncStorage, deviceId: uid, call, onApply, onStatus });
  let disposed = false; let profileListener = null; let boundProfile = null;
  const ready = engine.init(); currentEngine = engine;
  const watch = profileId => {
    if (profileId === boundProfile) return;
    profileListener?.(); boundProfile = profileId;
    profileListener = onSnapshot(doc(firestore, 'personalSyncProfiles', profileId), snapshot => {
      if (disposed || snapshot.metadata.fromCache || AppState.currentState !== 'active' || !engine.state?.profileId) return;
      const data = snapshot.data();
      if (data) engine.remote = { profileId, revision: data.revision, generation: data.generation };
      if (data) { engine.deviceCount = data.deviceCount; engine.status(Object.keys(engine.state.dirty).length ? 'pending' : 'synced'); }
      if (data && (data.revision !== engine.state.revision || data.generation !== engine.state.generation)) engine.sync().catch(() => {});
    }, error => engine.status('pending', error));
  };
  // Only existing opt-in bindings are read; no personal data upload on ordinary launch.
  const bindingListener = onSnapshot(doc(firestore, 'personalSyncDevices', uid), async snapshot => {
    await ready; if (disposed || snapshot.metadata.fromCache) return;
    if (!snapshot.exists()) return;
    const profileId = snapshot.data().profileId;
    if (!engine.state.profileId) {
      await engine.serial(async () => { engine.state.profileId = profileId; await engine.persist(); });
    } else if (engine.state.profileId !== profileId) await engine.switchProfile(profileId);
    watch(profileId); if (AppState.currentState === 'active') engine.sync().catch(() => {});
  }, error => { if (engine.state?.profileId) engine.status('pending', error); });
  const appListener = AppState.addEventListener('change', state => engine.setActive(state === 'active'));
  ready.then(() => { if (disposed) return; engine.setActive(AppState.currentState === 'active'); if (engine.state.profileId) watch(engine.state.profileId); }).catch(error => engine.status('error', error));
  return {
    ready, engine,
    async createCode(name) { await ready; const result = await engine.createCode(name); watch(engine.state.profileId); return result; },
    async prepare(code, name) { await ready; const result = await engine.prepare(code, name); watch(engine.state.profileId); return result; },
    async finish(link, mode) { await ready; const result = await engine.finish(link, mode); watch(result.profileId); return result; },
    async listDevices() { await ready; return call('listPersonalSyncDevices', {}); },
    async sync() { await ready; return engine.sync(); },
    async restore() { await ready; return engine.restoreBackup(); },
    dispose() { disposed = true; if (currentEngine === engine) currentEngine = null; bindingListener(); profileListener?.(); appListener.remove(); engine.dispose(); },
  };
}
