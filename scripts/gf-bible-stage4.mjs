import fs from 'node:fs';

const path = 'App.js';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  source = source.replace(from, to);
};

replaceOnce(
  "import { Directory, File, Paths } from 'expo-file-system';\n",
  "import { Directory, File, Paths } from 'expo-file-system';\nimport * as FileSystemLegacy from 'expo-file-system/legacy';\n",
  'legacy filesystem import',
);

replaceOnce(
  "const CUSTOM_TRANSLATIONS_KEY = '@chronological_bible/custom_translations';\n",
  "const CUSTOM_TRANSLATIONS_KEY = '@chronological_bible/custom_translations';\nconst BIBLE_IMPORT_FOLDER_URI_KEY = '@gf_bible/bible_import_folder_uri';\n",
  'bible import folder key',
);

const oldFnStart = `  const importBibleFolder = async () => {\n    if (Platform.OS !== 'android') {\n      Alert.alert('안내', '현재 BDF 폴더 등록은 안드로이드에서 사용할 수 있습니다.');\n      return;\n    }\n    setImportingBible(true);\n    try {\n      const selectedDirectory = await Directory.pickDirectoryAsync();\n      if (!selectedDirectory) return;\n      const bdfFiles = selectedDirectory.list().filter((item) => item.name?.toLowerCase().endsWith('.bdf'));\n      if (!bdfFiles.length) {\n        Alert.alert('BDF 파일 없음', '선택한 폴더에서 .bdf 파일을 찾지 못했습니다.');\n        return;\n      }\n`;

const newFnStart = `  const importBibleFolder = async () => {\n    if (Platform.OS !== 'android') {\n      Alert.alert('안내', '현재 BDF 폴더 등록은 안드로이드에서 사용할 수 있습니다.');\n      return;\n    }\n    setImportingBible(true);\n    try {\n      let selectedDirectory = null;\n      let savedFolderUri = await AsyncStorage.getItem(BIBLE_IMPORT_FOLDER_URI_KEY);\n\n      // Android 보안 정책상 Download/Bible을 앱이 무단으로 훑을 수는 없습니다.\n      // 한 번 사용자가 폴더 접근을 허용하면 이후부터는 저장된 폴더를 먼저 자동 확인합니다.\n      if (savedFolderUri) {\n        try {\n          const remembered = new Directory(savedFolderUri);\n          const rememberedFiles = remembered.list().filter((item) => item.name?.toLowerCase().endsWith('.bdf'));\n          if (rememberedFiles.length) selectedDirectory = remembered;\n        } catch (error) {\n          console.warn('Saved Bible folder access failed:', error);\n          savedFolderUri = null;\n          await AsyncStorage.removeItem(BIBLE_IMPORT_FOLDER_URI_KEY);\n        }\n      }\n\n      if (!selectedDirectory) {\n        let initialUri = null;\n        try {\n          initialUri = FileSystemLegacy.StorageAccessFramework.getUriForDirectoryInRoot('Download');\n        } catch {}\n        const permission = await FileSystemLegacy.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);\n        if (!permission?.granted || !permission?.directoryUri) return;\n        selectedDirectory = new Directory(permission.directoryUri);\n        await AsyncStorage.setItem(BIBLE_IMPORT_FOLDER_URI_KEY, permission.directoryUri);\n      }\n\n      const bdfFiles = selectedDirectory.list().filter((item) => item.name?.toLowerCase().endsWith('.bdf'));\n      if (!bdfFiles.length) {\n        await AsyncStorage.removeItem(BIBLE_IMPORT_FOLDER_URI_KEY);\n        Alert.alert('BDF 파일 없음', '선택한 폴더에서 .bdf 파일을 찾지 못했습니다. 다음 등록 때 Download 폴더에서 Bible 폴더를 다시 선택해 주세요.');\n        return;\n      }\n`;
replaceOnce(oldFnStart, newFnStart, 'BDF import folder flow');

replaceOnce(
  "              <Text style={styles.settingsDescription}>성경 데이터가 들어 있는 폴더를 선택하면 같은 이름의 분할 BDF 파일들을 하나의 번역본으로 합쳐 이 휴대폰에만 저장합니다.</Text>\n",
  "              <Text style={styles.settingsDescription}>처음 한 번 Download/Bible 폴더 접근을 허용하면 이후에는 그 폴더의 새 BDF 파일을 먼저 자동 확인합니다. 접근이 없거나 파일이 없으면 폴더를 다시 선택할 수 있습니다.</Text>\n",
  'BDF settings description',
);

replaceOnce(
  "                <Text style={styles.importBibleButtonText}>{importingBible ? 'BDF 파일 확인 중…' : '＋ 성경번역본 추가'}</Text>\n",
  "                <Text style={styles.importBibleButtonText}>{importingBible ? 'BDF 파일 확인 중…' : '＋ BDF 자동 확인 · 번역본 추가'}</Text>\n",
  'BDF button label',
);

fs.writeFileSync(path, source);
console.log('GF Bible stage4 patch applied.');
