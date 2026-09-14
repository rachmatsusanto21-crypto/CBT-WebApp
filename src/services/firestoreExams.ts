import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Exam } from '../types';

/**
 * Synchronizes an exam to Firestore collection 'active_exams' so that
 * students on any other device (phones, tablets, laptops) can instantly
 * load the full questions using just a tiny URL (e.g. ?mode=siswa&examCode=MAT101).
 */
export async function syncExamToFirestore(exam: Exam): Promise<boolean> {
  try {
    if (!exam || !exam.code) return false;
    const cleanCode = exam.code.trim().toUpperCase();
    
    // Clean exam object without undefined values for Firestore compatibility
    const cleanExam = JSON.parse(JSON.stringify(exam));
    
    await setDoc(doc(db, 'active_exams', cleanCode), {
      ...cleanExam,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    console.info(`[Firestore] Exam ${cleanCode} synchronized successfully.`);
    return true;
  } catch (error) {
    console.warn(`[Firestore] Notice syncing exam ${exam?.code}:`, error);
    return false;
  }
}

/**
 * Fetches an active exam by its short code directly from Firestore.
 */
export async function fetchExamFromFirestore(code: string): Promise<Exam | null> {
  try {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    const docRef = doc(db, 'active_exams', cleanCode);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      const data = snap.data() as Exam;
      return data;
    }
    return null;
  } catch (error) {
    console.warn(`[Firestore] Notice fetching exam by code ${code}:`, error);
    return null;
  }
}
