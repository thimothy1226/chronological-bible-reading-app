import fs from 'node:fs';

const file = 'App.js';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  "  const canManagePeople = isSuperAdmin || currentAdminRole === 'manager';\n",
  "  const canManagePeople = isSuperAdmin || currentAdminRole === 'manager';\n  const isRepresentativeAdmin = isSuperAdmin || currentAdminRole === 'manager';\n  const canManageMembers = canManageCurrentGroup;\n",
  'admin capability helpers',
);

replaceOnce(
  "  const loginAsAdmin = async () => {\n    if (!adminEmail.trim() || !adminPassword) {\n      Alert.alert('입력 확인', '관리자 이메일과 비밀번호를 입력해 주세요.');\n      return;\n    }\n    setAdminBusy(true);\n    try {\n      const credential = await signInWithEmailAndPassword(firebaseAuth, adminEmail.trim(), adminPassword);\n      const loginAdminDoc = credential.user.uid === ADMIN_UID ? null : await getDoc(doc(firestore, 'admins', credential.user.uid));\n      const allowed = credential.user.uid === ADMIN_UID\n        || (loginAdminDoc.exists() && loginAdminDoc.data()?.active !== false);\n      if (!allowed) {\n        await signOut(firebaseAuth);\n        Alert.alert('권한 없음', '등록된 관리자 계정이 아닙니다.');\n        return;\n      }\n      setAdminAuthorized(true);\n      setAdminPassword('');\n      setAdminLoginOpen(false);\n      Alert.alert('로그인 완료', credential.user.uid === ADMIN_UID ? '최고 관리자로 로그인했습니다.' : '담당 기관의 공지사항을 관리할 수 있습니다.');\n    } catch (error) {\n      console.warn('Admin login failed:', error);\n      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해 주세요.');\n    } finally {\n      setAdminBusy(false);\n    }\n  };",
  "  const loginAsAdmin = async () => {\n    const normalizedEmail = adminEmail.trim().toLowerCase();\n    if (!normalizedEmail || !adminPassword) {\n      Alert.alert('입력 확인', '관리자 이메일과 비밀번호를 입력해 주세요.');\n      return;\n    }\n    setAdminBusy(true);\n    try {\n      const credential = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, adminPassword);\n      await credential.user.getIdToken(true);\n      const loginAdminDoc = credential.user.uid === ADMIN_UID ? null : await getDoc(doc(firestore, 'admins', credential.user.uid));\n      const record = loginAdminDoc?.exists() ? loginAdminDoc.data() : null;\n      const allowed = credential.user.uid === ADMIN_UID || (record && record.active !== false);\n      if (!allowed) {\n        await signOut(firebaseAuth);\n        Alert.alert('관리자 권한 확인 필요', record?.active === false\n          ? '이 관리자 계정은 현재 비활성 상태입니다. 대표관리자 또는 최고관리자에게 문의해 주세요.'\n          : '로그인은 되었지만 관리자 권한 정보가 연결되어 있지 않습니다. 관리자 등록을 다시 확인해 주세요.');\n        return;\n      }\n      setAdminAuthorized(true);\n      if (record) setAdminRecord(record);\n      setAdminPassword('');\n      setAdminLoginOpen(false);\n      const role = credential.user.uid === ADMIN_UID ? '최고관리자' : ((record?.groupRoles && Object.values(record.groupRoles).includes('manager')) || record?.role !== 'subAdmin' ? '대표관리자' : '부대표관리자');\n      Alert.alert('로그인 완료', `${role}로 로그인했습니다.`);\n    } catch (error) {\n      console.warn('Admin login failed:', error);\n      const code = String(error?.code || '');\n      Alert.alert('로그인 실패', code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')\n        ? '이메일 또는 비밀번호를 확인해 주세요.'\n        : '관리자 로그인 중 오류가 발생했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');\n    } finally {\n      setAdminBusy(false);\n    }\n  };",
  'admin login diagnostics',
);

replaceOnce(
  "  const removeGroupMember = (member) => {\n    if (!canManagePeople) return;",
  "  const removeGroupMember = (member) => {\n    if (!canManageMembers) return;",
  'deputy member removal',
);

replaceOnce(
  "  const createCommunityGroup = async () => {\n    if (!isSuperAdmin) return;",
  "  const createCommunityGroup = async () => {\n    if (!isRepresentativeAdmin) return;",
  'representative group creation',
);

replaceOnce(
  "      await updateDoc(doc(firestore, 'groups', created.id), { managementCode });\n      setNewGroupName('');",
  "      await updateDoc(doc(firestore, 'groups', created.id), { managementCode });\n      if (!isSuperAdmin && adminUser?.uid) {\n        const nextGroupIds = [...new Set([...(adminRecord?.groupIds || []), created.id])];\n        const nextGroupRoles = { ...(adminRecord?.groupRoles || {}), [created.id]: 'manager' };\n        await updateDoc(doc(firestore, 'admins', adminUser.uid), {\n          groupIds: nextGroupIds,\n          groupRoles: nextGroupRoles,\n          role: 'groupAdmin',\n          active: true,\n          updatedAt: serverTimestamp(),\n        });\n        setAdminRecord((previous) => ({ ...(previous || {}), groupIds: nextGroupIds, groupRoles: nextGroupRoles, role: 'groupAdmin', active: true }));\n      }\n      setNewGroupName('');",
  'assign representative to new group',
);

source = source.replaceAll("currentGroup?.name || '가입한 기관 없음'", "currentGroup?.name || '가입한 그룹 없음'");
source = source.replaceAll("adminGroup?.name || '관리 기관 선택'", "adminGroup?.name || '관리 그룹 선택'");
source = source.replaceAll("'기관 관리자 로그인됨'", "currentAdminRole === 'manager' ? '대표관리자 로그인됨' : '부대표관리자 로그인됨'");
source = source.replaceAll("'최고 관리자 로그인됨'", "'최고관리자 로그인됨'");
source = source.replaceAll('일반 회원 화면과 분리된 관리실에서 모든 기관을 관리합니다.', '일반 회원 화면과 분리된 관리실에서 모든 그룹을 관리합니다.');
source = source.replaceAll('관리실에서 담당 기관을 선택해 게시글과 회원을 관리합니다.', '관리자 모드에서 담당 그룹의 게시글과 회원을 관리합니다.');
source = source.replaceAll('기관 변경  ▼', '그룹 변경  ▼');
source = source.replaceAll('선택한 교회·기관의 공지사항입니다.', '선택한 그룹의 공지사항입니다.');
source = source.replaceAll('기관 초대코드', '그룹 초대코드');
source = source.replaceAll("{canManagePeople && <TouchableOpacity onPress={openGroupProfileEditor}", "{canManageCurrentGroup && <TouchableOpacity onPress={openGroupProfileEditor}");
source = source.replaceAll('기관 주소·소개 입력', '그룹 주소·소개 입력');
source = source.replaceAll("＋ {isSuperAdmin ? '그룹관리자' : '부관리자'} 등록", "＋ {isSuperAdmin ? '대표관리자' : '부대표관리자'} 등록");
source = source.replaceAll('관리자 목록 및 권한 관리', '부대표관리자 목록 및 권한 관리');
source = source.replaceAll("{adminRoomMode && canManagePeople && <TouchableOpacity onPress={() => setMemberManagerOpen(true)}", "{adminRoomMode && canManageMembers && <TouchableOpacity onPress={() => setMemberManagerOpen(true)}");
source = source.replaceAll("{adminRoomMode && isSuperAdmin && <View style={styles.managementAccordionWrap}>", "{adminRoomMode && isRepresentativeAdmin && <View style={styles.managementAccordionWrap}>");
source = source.replaceAll('＋ 새 교회·기관 관리', '＋ 새 그룹 관리');
source = source.replaceAll('＋ 새 교회·기관 만들기', '＋ 새 그룹 만들기');
source = source.replaceAll("{isSuperAdmin && <TouchableOpacity onPress={() => setGroupManagerOpen(true)} style={styles.groupManageButton}><Text style={styles.groupManageButtonText}>전체 교회·기관 수정 및 삭제</Text></TouchableOpacity>}", "{isSuperAdmin && <TouchableOpacity onPress={() => setGroupManagerOpen(true)} style={styles.groupManageButton}><Text style={styles.groupManageButtonText}>전체 그룹 수정 및 삭제</Text></TouchableOpacity>}");
source = source.replaceAll("<TouchableOpacity onPress={() => setGroupManagerOpen(true)} style={styles.groupManageButton}><Text style={styles.groupManageButtonText}>전체 교회·기관 수정 및 삭제</Text></TouchableOpacity>", "{isSuperAdmin && <TouchableOpacity onPress={() => setGroupManagerOpen(true)} style={styles.groupManageButton}><Text style={styles.groupManageButtonText}>전체 그룹 수정 및 삭제</Text></TouchableOpacity>}");
source = source.replaceAll("`${assignedRole === 'manager' ? '그룹관리자' : '부관리자'} 권한을 다시 활성화했습니다.`", "`${assignedRole === 'manager' ? '대표관리자' : '부대표관리자'} 권한을 다시 활성화했습니다.`");
source = source.replaceAll("`${adminGroupName}의 ${assignedRole === 'manager' ? '그룹관리자' : '부관리자'}가 등록되었습니다.`", "`${adminGroupName}의 ${assignedRole === 'manager' ? '대표관리자' : '부대표관리자'}가 등록되었습니다.`");
source = source.replaceAll('새 그룹관리자가 되었습니다. 본인은 부관리자로 변경되었습니다.', '새 대표관리자가 되었습니다. 본인은 부대표관리자로 변경되었습니다.');
source = source.replaceAll("'기관을 찾을 수 없음'", "'그룹을 찾을 수 없음'");
source = source.replaceAll('기관 관리자에 의해 탈퇴 처리된 회원번호입니다. 기관 관리자에게 문의해 주세요.', '그룹 관리자에 의해 탈퇴 처리된 회원번호입니다. 그룹 관리자에게 문의해 주세요.');
source = source.replaceAll('해당 기관의 관리자 권한도 해제되었습니다.', '해당 그룹의 관리자 권한도 해제되었습니다.');
source = source.replaceAll('교회·기관 이름을 입력해 주세요.', '그룹 이름을 입력해 주세요.');
source = source.replaceAll("Alert.alert('기관 생성 완료'", "Alert.alert('그룹 생성 완료'");
source = source.replaceAll('교회·기관을 만들지 못했습니다.', '그룹을 만들지 못했습니다.');

fs.writeFileSync(file, source);
console.log('GF Bible stage3 admin patch applied.');
