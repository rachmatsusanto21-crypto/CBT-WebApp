import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Exam, ExamResult, SavedQuestionPackage, Student, SchoolSettings } from '../types';
import { filterRealExams, filterRealPackages, filterRealStudents } from './googleDriveService';

export interface SyncProgressCallback {
  (step: string, progressPercent: number, detail?: string): void;
}

export interface SyncSummary {
  studentsCount: number;
  examsCount: number;
  packagesCount: number;
  resultsCount: number;
  analysisCount: number;
  syncedAt: string;
}

/**
 * Calculates comprehensive Item Analysis (Tingkat Kesukaran & Daya Pembeda)
 * and score statistics for all exams that have student submissions.
 */
export function generateExamsAnalysis(exams: Exam[], results: ExamResult[]) {
  return exams.map((exam) => {
    const examSubmissions = results.filter((r) => r.examCode === exam.code || r.examTitle === exam.title);
    const totalParticipants = examSubmissions.length;
    const scores = examSubmissions.map((r) => r.score);
    const averageScore = totalParticipants > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / totalParticipants) * 10) / 10 : 0;
    const highestScore = totalParticipants > 0 ? Math.max(...scores) : 0;
    const lowestScore = totalParticipants > 0 ? Math.min(...scores) : 0;
    const passedCount = scores.filter((s) => s >= 75).length;
    const passRate = totalParticipants > 0 ? Math.round((passedCount / totalParticipants) * 100) : 0;

    // Item-by-item analysis
    const questionAnalysis = (exam.questions || []).map((q, idx) => {
      const qNum = q.number || idx + 1;
      let wrongCount = 0;
      examSubmissions.forEach((sub) => {
        const foundWrong = (sub.wrongAnswers || []).some((w) => w.questionNumber === qNum);
        if (foundWrong) wrongCount++;
      });
      const correctCount = Math.max(0, totalParticipants - wrongCount);
      const difficultyIndex = totalParticipants > 0 ? Math.round((correctCount / totalParticipants) * 100) / 100 : 0.5;
      
      let difficultyCategory = 'Sedang';
      if (difficultyIndex > 0.7) difficultyCategory = 'Mudah';
      else if (difficultyIndex < 0.3) difficultyCategory = 'Sukar';

      return {
        number: qNum,
        questionText: q.question?.slice(0, 100) || '',
        cognitiveLevel: q.cognitiveLevel || 'C2',
        correctCount,
        wrongCount,
        difficultyIndex,
        difficultyCategory,
      };
    });

    return {
      id: `analysis-${exam.code}-${Date.now()}`,
      examId: exam.id,
      examCode: exam.code,
      examTitle: exam.title,
      subject: exam.subject,
      grade: exam.grade,
      totalParticipants,
      averageScore,
      highestScore,
      lowestScore,
      passRate,
      questionAnalysis,
      analyzedAt: new Date().toISOString(),
    };
  });
}

/**
 * 1. Uploads all student master records to Firestore collection 'students'
 */
export async function syncStudentsToFirestore(students: Student[]): Promise<number> {
  const cleanStudents = filterRealStudents(students);
  if (cleanStudents.length === 0) return 0;

  const batch = writeBatch(db);
  cleanStudents.forEach((std) => {
    const docRef = doc(db, 'students', std.id);
    batch.set(docRef, {
      ...std,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });

  await batch.commit();
  return cleanStudents.length;
}

/**
 * 2. Uploads all exams (both master and active student packages) to Firestore
 */
export async function syncExamsToFirestore(exams: Exam[]): Promise<number> {
  const cleanExams = filterRealExams(exams);
  if (cleanExams.length === 0) return 0;

  for (const exam of cleanExams) {
    const cleanExam = JSON.parse(JSON.stringify(exam));
    
    // Save to master collection 'exams'
    await setDoc(doc(db, 'exams', exam.id), {
      ...cleanExam,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Save to 'active_exams' using exam.code as document ID so students on Firebase web app can load immediately
    if (exam.code) {
      const cleanCode = exam.code.trim().toUpperCase();
      await setDoc(doc(db, 'active_exams', cleanCode), {
        ...cleanExam,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  }

  return cleanExams.length;
}

/**
 * 3. Uploads question history packages to Firestore
 */
export async function syncPackagesToFirestore(packages: SavedQuestionPackage[]): Promise<number> {
  const cleanPackages = filterRealPackages(packages);
  if (cleanPackages.length === 0) return 0;

  const batch = writeBatch(db);
  cleanPackages.forEach((pkg) => {
    const docRef = doc(db, 'saved_packages', pkg.id);
    batch.set(docRef, {
      ...pkg,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });

  await batch.commit();
  return cleanPackages.length;
}

/**
 * 4. Uploads student exam results (nilai) to Firestore collection 'exam_results'
 */
export async function syncResultsToFirestore(results: ExamResult[]): Promise<number> {
  if (!results || results.length === 0) return 0;

  const batch = writeBatch(db);
  results.forEach((res) => {
    const docRef = doc(db, 'exam_results', res.id);
    batch.set(docRef, {
      ...res,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });

  await batch.commit();
  return results.length;
}

/**
 * 5. Uploads item analysis & exam statistics to Firestore collection 'exam_analysis'
 */
export async function syncAnalysisToFirestore(analysisList: any[]): Promise<number> {
  if (!analysisList || analysisList.length === 0) return 0;

  const batch = writeBatch(db);
  analysisList.forEach((item) => {
    const docId = item.examCode ? `analysis_${item.examCode}` : (item.id || `analysis_${Date.now()}`);
    const docRef = doc(db, 'exam_analysis', docId);
    batch.set(docRef, {
      ...item,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });

  await batch.commit();
  return analysisList.length;
}

/**
 * Master sync to Firestore: Synchronizes all 4 categories (Siswa, Soal, Nilai, Analisis)
 */
export async function syncAllToFirestore(
  payload: {
    students: Student[];
    exams: Exam[];
    savedPackages: SavedQuestionPackage[];
    results: ExamResult[];
    schoolSettings?: SchoolSettings;
  },
  onProgress?: SyncProgressCallback
): Promise<SyncSummary> {
  onProgress?.('Menghubungkan ke Firebase Firestore...', 10);
  
  // 1. Siswa
  onProgress?.('Mengunggah Data Siswa ke Firestore...', 25);
  const studentsCount = await syncStudentsToFirestore(payload.students);

  // 2. Soal & Bank Soal
  onProgress?.('Mengunggah Naskah Soal & Paket Ujian ke Firestore...', 50);
  const examsCount = await syncExamsToFirestore(payload.exams);
  const packagesCount = await syncPackagesToFirestore(payload.savedPackages);

  // 3. Nilai
  onProgress?.('Mengunggah Rekap Nilai Siswa ke Firestore...', 75);
  const resultsCount = await syncResultsToFirestore(payload.results);

  // 4. Analisis
  onProgress?.('Menghitung dan Mengunggah Analisis Butir Soal ke Firestore...', 90);
  const analysisData = generateExamsAnalysis(payload.exams, payload.results);
  const analysisCount = await syncAnalysisToFirestore(analysisData);

  // Optional: Kop Sekolah
  if (payload.schoolSettings) {
    try {
      await setDoc(doc(db, 'school_settings', 'default'), {
        ...payload.schoolSettings,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch {}
  }

  onProgress?.('Sinkronisasi Firebase selesai!', 100);

  return {
    studentsCount,
    examsCount,
    packagesCount,
    resultsCount,
    analysisCount,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Downloads all data from Firestore back into the application
 */
export async function fetchAllFromFirestore(): Promise<{
  students: Student[];
  exams: Exam[];
  packages: SavedQuestionPackage[];
  results: ExamResult[];
  analysis: any[];
}> {
  const [stdSnap, examSnap, pkgSnap, resSnap, anaSnap] = await Promise.all([
    getDocs(collection(db, 'students')),
    getDocs(collection(db, 'exams')),
    getDocs(collection(db, 'saved_packages')),
    getDocs(collection(db, 'exam_results')),
    getDocs(collection(db, 'exam_analysis')),
  ]);

  const students: Student[] = stdSnap.docs.map((d) => d.data() as Student);
  const exams: Exam[] = examSnap.docs.map((d) => d.data() as Exam);
  const packages: SavedQuestionPackage[] = pkgSnap.docs.map((d) => d.data() as SavedQuestionPackage);
  const results: ExamResult[] = resSnap.docs.map((d) => d.data() as ExamResult);
  const analysis: any[] = anaSnap.docs.map((d) => d.data());

  return { students, exams, packages, results, analysis };
}
