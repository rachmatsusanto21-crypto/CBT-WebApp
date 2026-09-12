import { Exam, SavedQuestionPackage, Student, SchoolSettings } from '../types';

export interface DriveFileInfo {
  fileId: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  folderId?: string;
}

export interface DriveFolderStructure {
  rootFolderId: string;
  dataSoalFolderId: string;
  paketUjianFolderId: string;
  dataSiswaFolderId: string;
  dataNilaiFolderId: string;
}

const ROOT_FOLDER_NAME = 'CBT Web App - Backup';
const SUBFOLDER_DATA_SOAL = 'Data Soal';
const SUBFOLDER_PAKET_UJIAN = 'Paket Ujian Aktif';
const SUBFOLDER_DATA_SISWA = 'Data Siswa';
const SUBFOLDER_DATA_NILAI = 'Data Nilai';

/**
 * Checks whether an exam is an initial AI Studio sample
 */
export function isSampleExam(exam: Exam): boolean {
  if (!exam) return false;
  return (
    exam.id === 'exam-1' ||
    exam.id === 'exam-2' ||
    exam.code === 'MAT101' ||
    exam.code === 'IPA202' ||
    (exam.title && exam.title.includes('Aljabar & Fungsi')) ||
    (exam.title && exam.title.includes('Ekosistem & Hukum Newton'))
  );
}

/**
 * Checks whether a question package is an initial AI Studio sample
 */
export function isSamplePackage(pkg: SavedQuestionPackage): boolean {
  if (!pkg) return false;
  return (
    pkg.id === 'pkg-pancasila-1' ||
    (pkg.title && pkg.title.toLowerCase().includes('pendidikan pancasila'))
  );
}

/**
 * Checks whether a student is an initial AI Studio sample
 */
export function isSampleStudent(std: Student): boolean {
  if (!std) return false;
  return (
    /^std-(10|[1-9])$/.test(std.id) ||
    std.nisn === '0081234567' ||
    std.name === 'Ahmad Dahlan' ||
    std.name === 'Budi Santoso'
  );
}

export function filterRealExams(exams: Exam[]): Exam[] {
  const real = exams.filter((e) => !isSampleExam(e));
  return real.length > 0 ? real : exams;
}

export function filterRealPackages(packages: SavedQuestionPackage[]): SavedQuestionPackage[] {
  const real = packages.filter((p) => !isSamplePackage(p));
  return real.length > 0 ? real : packages;
}

export function filterRealStudents(students: Student[]): Student[] {
  const real = students.filter((s) => !isSampleStudent(s));
  return real.length > 0 ? real : students;
}

// In-memory cache for folder IDs
let cachedFolders: DriveFolderStructure | null = null;

/**
 * Searches for a folder by name inside a parent (or root if not provided).
 * Creates it if it doesn't exist.
 */
export async function findOrCreateFolder(
  folderName: string,
  parentId?: string,
  accessToken?: string
): Promise<string> {
  if (!accessToken) {
    throw new Error('Access Token Google Drive tidak tersedia. Silakan hubungkan Google Drive.');
  }

  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Gagal mencari folder "${folderName}" di Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat folder "${folderName}" di Google Drive: ${errText}`);
  }

  const createData = await createRes.json();
  const folderId = createData.id;

  // Make folder publicly accessible (read-only) so any student can access questions inside
  try {
    await setFilePublicRead(folderId, accessToken);
  } catch (e) {
    console.warn(`Could not set public permission on folder ${folderName}:`, e);
  }

  return folderId;
}

/**
 * Sets file or folder permissions to "Anyone with the link can view (reader)"
 * Fulfills Requirement 4: anyone with link can access, with permission "read".
 */
export async function setFilePublicRead(fileId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to set public read permission on file ${fileId}:`, err);
    return false;
  }
}

/**
 * Ensures complete CBT folder structure exists on Google Drive
 */
export async function ensureDriveStructure(accessToken: string): Promise<DriveFolderStructure> {
  if (cachedFolders) {
    return cachedFolders;
  }

  // 1. Root: CBT Web App - Backup
  const rootFolderId = await findOrCreateFolder(ROOT_FOLDER_NAME, undefined, accessToken);

  // 2. Subfolders inside root
  const [dataSoalFolderId, paketUjianFolderId, dataSiswaFolderId, dataNilaiFolderId] = await Promise.all([
    findOrCreateFolder(SUBFOLDER_DATA_SOAL, rootFolderId, accessToken),
    findOrCreateFolder(SUBFOLDER_PAKET_UJIAN, rootFolderId, accessToken),
    findOrCreateFolder(SUBFOLDER_DATA_SISWA, rootFolderId, accessToken),
    findOrCreateFolder(SUBFOLDER_DATA_NILAI, rootFolderId, accessToken),
  ]);

  cachedFolders = {
    rootFolderId,
    dataSoalFolderId,
    paketUjianFolderId,
    dataSiswaFolderId,
    dataNilaiFolderId,
  };

  return cachedFolders;
}

/**
 * Uploads or updates a JSON file in Google Drive.
 * Automatically gives anyone-with-link read permission.
 */
export async function saveJsonToDrive(
  fileName: string,
  content: any,
  folderId: string,
  accessToken: string,
  makePublic = true
): Promise<DriveFileInfo> {
  if (!accessToken) {
    throw new Error('Access Token Google Drive dibutuhkan.');
  }

  const jsonString = JSON.stringify(content, null, 2);

  // Check if file already exists in folder
  const query = `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,webContentLink)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let fileId = '';
  let webViewLink = '';
  let webContentLink = '';

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      fileId = searchData.files[0].id;
      webViewLink = searchData.files[0].webViewLink;
      webContentLink = searchData.files[0].webContentLink;
    }
  }

  if (fileId) {
    // Update existing file content
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: jsonString,
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`Gagal memperbarui file di Google Drive: ${err}`);
    }
  } else {
    // Create new file with multipart upload
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonString +
      closeDelimiter;

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Gagal mengunggah file ke Google Drive: ${err}`);
    }

    const created = await createRes.json();
    fileId = created.id;
    webViewLink = created.webViewLink;
    webContentLink = created.webContentLink;
  }

  // Ensure read permission for anyone with link
  if (makePublic && fileId) {
    await setFilePublicRead(fileId, accessToken);
  }

  return {
    fileId,
    name: fileName,
    webViewLink: webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`,
    folderId,
  };
}

/**
 * Saves a single question package into subfolder "Data Soal"
 * Fulfills Requirement 1 & 3: Riwayat soal tersimpan di subfolder Data Soal,
 * dan merupakan data hasil buatan guru, bukan data bawaan AI studio.
 */
export async function saveQuestionPackageToDrive(
  pkg: SavedQuestionPackage,
  accessToken: string
): Promise<DriveFileInfo> {
  const structure = await ensureDriveStructure(accessToken);
  const cleanTitle = (pkg.title || 'Paket_Soal').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
  const fileName = `Soal_${cleanTitle}_${pkg.id}.json`;

  const driveFile = await saveJsonToDrive(fileName, pkg, structure.dataSoalFolderId, accessToken, true);
  return driveFile;
}

/**
 * Saves all question packages (riwayat soal) into subfolder "Data Soal"
 */
export async function saveAllQuestionPackagesToDrive(
  packages: SavedQuestionPackage[],
  accessToken: string
): Promise<DriveFileInfo> {
  const structure = await ensureDriveStructure(accessToken);
  const dataToSave = filterRealPackages(packages);

  // Also save a unified catalog file for rapid batch loading
  const catalogFile = await saveJsonToDrive(
    'katalog_riwayat_soal.json',
    dataToSave,
    structure.dataSoalFolderId,
    accessToken,
    true
  );

  // Save individual files in parallel (up to 5)
  for (const pkg of dataToSave) {
    try {
      const cleanTitle = (pkg.title || 'Paket_Soal').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      await saveJsonToDrive(`Soal_${cleanTitle}_${pkg.id}.json`, pkg, structure.dataSoalFolderId, accessToken, true);
    } catch (e) {
      console.warn(`Failed to save individual package ${pkg.id}:`, e);
    }
  }

  return catalogFile;
}

/**
 * Saves active exams into subfolder "Paket Ujian Aktif"
 * Fulfills Requirement 2, 3, 4: Soal buatan user tersimpan di Google Drive,
 * dengan izin Anyone with link - Read, sehingga link mode siswa dapat dibuka
 * di gawai siswa manapun tanpa gagal atau tertukar dengan soal AI Studio.
 */
export async function saveActiveExamsToDrive(
  exams: Exam[],
  accessToken: string
): Promise<DriveFileInfo> {
  const structure = await ensureDriveStructure(accessToken);
  const dataToSave = filterRealExams(exams);

  // 1. Save master active exams JSON
  const masterFile = await saveJsonToDrive(
    'paket_ujian_cbt.json',
    dataToSave,
    structure.paketUjianFolderId,
    accessToken,
    true
  );

  // 2. Save individual exam files for per-exam direct link loading: ujian_{CODE}.json
  for (const ex of dataToSave) {
    try {
      const cleanCode = (ex.code || 'EXAM').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileInfo = await saveJsonToDrive(
        `ujian_${cleanCode}.json`,
        ex,
        structure.paketUjianFolderId,
        accessToken,
        true
      );
      // Cache file ID in localStorage
      try {
        const storedMapStr = localStorage.getItem('cbt_gdrive_exam_file_ids') || '{}';
        const map = JSON.parse(storedMapStr);
        map[ex.id] = fileInfo.fileId;
        map[ex.code] = fileInfo.fileId;
        localStorage.setItem('cbt_gdrive_exam_file_ids', JSON.stringify(map));
      } catch {}
    } catch (e) {
      console.warn(`Failed to save individual exam ${ex.code}:`, e);
    }
  }

  return masterFile;
}

/**
 * Saves a single active exam into subfolder "Paket Ujian Aktif"
 * with public read permission
 */
export async function saveActiveExamToDrive(
  exam: Exam,
  accessToken: string
): Promise<DriveFileInfo> {
  const structure = await ensureDriveStructure(accessToken);
  const cleanCode = (exam.code || 'EXAM').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileInfo = await saveJsonToDrive(
    `ujian_${cleanCode}.json`,
    exam,
    structure.paketUjianFolderId,
    accessToken,
    true
  );
  try {
    const storedMapStr = localStorage.getItem('cbt_gdrive_exam_file_ids') || '{}';
    const map = JSON.parse(storedMapStr);
    map[exam.id] = fileInfo.fileId;
    map[exam.code] = fileInfo.fileId;
    localStorage.setItem('cbt_gdrive_exam_file_ids', JSON.stringify(map));
  } catch {}
  return fileInfo;
}

/**
 * Saves student master data into subfolder "Data Siswa"
 */
export async function saveStudentsToDrive(
  students: Student[],
  accessToken: string
): Promise<DriveFileInfo> {
  const structure = await ensureDriveStructure(accessToken);
  const dataToSave = filterRealStudents(students);
  return saveJsonToDrive('data_siswa.json', dataToSave, structure.dataSiswaFolderId, accessToken, true);
}

/**
 * Saves exam results into subfolder "Data Nilai"
 */
export async function saveResultsToDrive(
  results: any[],
  accessToken: string
): Promise<DriveFileInfo> {
  const structure = await ensureDriveStructure(accessToken);
  return saveJsonToDrive('rekap_nilai_ujian.json', results, structure.dataNilaiFolderId, accessToken, true);
}

/**
 * Saves full system backup into root folder "CBT Web App - Backup"
 */
export async function saveFullBackupToDrive(
  backupData: {
    exams: Exam[];
    savedPackages: SavedQuestionPackage[];
    students: Student[];
    schoolSettings: SchoolSettings;
    timestamp: string;
  },
  accessToken: string
): Promise<DriveFileInfo> {
  const structure = await ensureDriveStructure(accessToken);
  const dateStr = new Date().toISOString().slice(0, 10);
  
  const cleanBackup = {
    exams: filterRealExams(backupData.exams),
    savedPackages: filterRealPackages(backupData.savedPackages),
    students: filterRealStudents(backupData.students),
    schoolSettings: backupData.schoolSettings,
    timestamp: backupData.timestamp || new Date().toISOString(),
  };

  // 1. Save dated backup in root folder
  const backupFile = await saveJsonToDrive(
    `CBT_Backup_${dateStr}_${Date.now()}.json`,
    cleanBackup,
    structure.rootFolderId,
    accessToken,
    true
  );

  // 2. Save latest master backup pointer
  await saveJsonToDrive(
    'CBT_Master_Latest.json',
    cleanBackup,
    structure.rootFolderId,
    accessToken,
    true
  );

  // 3. Save to respective subfolders as well for maximum organization
  await Promise.all([
    saveActiveExamsToDrive(cleanBackup.exams, accessToken),
    saveAllQuestionPackagesToDrive(cleanBackup.savedPackages, accessToken),
    saveStudentsToDrive(cleanBackup.students, accessToken),
  ]);

  return backupFile;
}

/**
 * Verifies live Google Drive connection and checks folders
 */
export async function verifyDriveConnection(accessToken: string): Promise<{
  connected: boolean;
  userEmail?: string;
  userName?: string;
  structure?: DriveFolderStructure;
  error?: string;
}> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      return { connected: false, error: `Google Drive API error (${res.status}): ${errText}` };
    }
    const data = await res.json();
    const user = data.user;
    const structure = await ensureDriveStructure(accessToken);
    return {
      connected: true,
      userEmail: user?.emailAddress,
      userName: user?.displayName,
      structure,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Koneksi ke Google Drive gagal',
    };
  }
}

/**
 * Loads active exams from Google Drive:
 * Either using accessToken, or if not signed in, fetches from public file ID or server sync!
 */
export async function loadActiveExamsFromDrive(
  accessToken?: string,
  customFileId?: string
): Promise<Exam[] | null> {
  try {
    if (customFileId) {
      const url = `https://drive.google.com/uc?id=${customFileId}&export=download`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [data];
      }
    }

    if (accessToken) {
      const structure = await ensureDriveStructure(accessToken);
      const query = `name = 'paket_ujian_cbt.json' and '${structure.paketUjianFolderId}' in parents and trashed = false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          const fileId = data.files[0].id;
          const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (contentRes.ok) {
            return await contentRes.json();
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load active exams directly from Google Drive:', err);
  }
  return null;
}

/**
 * Loads question packages from Google Drive "Data Soal" subfolder
 */
export async function loadQuestionHistoryFromDrive(
  accessToken: string
): Promise<SavedQuestionPackage[] | null> {
  try {
    const structure = await ensureDriveStructure(accessToken);
    
    // First try catalog file
    const catalogQuery = `name = 'katalog_riwayat_soal.json' and '${structure.dataSoalFolderId}' in parents and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(catalogQuery)}&fields=files(id)&spaces=drive`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const contentRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${searchData.files[0].id}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (contentRes.ok) {
          return await contentRes.json();
        }
      }
    }

    // Otherwise list individual files in Data Soal
    const listQuery = `'${structure.dataSoalFolderId}' in parents and mimeType = 'application/json' and trashed = false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name)&spaces=drive`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (listRes.ok) {
      const listData = await listRes.json();
      if (listData.files && listData.files.length > 0) {
        const packages: SavedQuestionPackage[] = [];
        for (const f of listData.files.slice(0, 30)) {
          try {
            const itemRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (itemRes.ok) {
              const itemData = await itemRes.json();
              if (itemData && itemData.id && itemData.questions) {
                packages.push(itemData);
              }
            }
          } catch (e) {
            console.warn(`Error reading file ${f.id}:`, e);
          }
        }
        if (packages.length > 0) return packages;
      }
    }
  } catch (err) {
    console.warn('Failed to load question packages from Google Drive:', err);
  }
  return null;
}

/**
 * Loads students from Google Drive folder "Data Siswa":
 */
export async function loadStudentsFromDrive(accessToken: string): Promise<Student[] | null> {
  try {
    const structure = await ensureDriveStructure(accessToken);
    const fileName = 'data_siswa.json';
    const query = `name = '${fileName}' and '${structure.dataSiswaFolderId}' in parents and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const fileId = searchData.files[0].id;
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (contentRes.ok) {
          const data = await contentRes.json();
          if (Array.isArray(data)) {
            return filterRealStudents(data);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load students from Google Drive:', err);
  }
  return null;
}

