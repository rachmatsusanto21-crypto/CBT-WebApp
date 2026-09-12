import { Exam } from '../types';

/**
 * Encodes an Exam into a URL-safe Base64 string.
 * Uses TextEncoder to safely support Indonesian characters, mathematical symbols, superscripts, etc.
 */
export function encodeExamPayload(exam: Exam): string {
  try {
    const compact = {
      id: exam.id,
      c: exam.code,
      t: exam.title,
      s: exam.subject,
      g: exam.grade,
      tp: exam.examType,
      k: exam.token,
      d: exam.durationMinutes,
      q: (exam.questions || []).map((q) => ({
        id: q.id,
        n: q.number,
        q: q.question,
        img: q.imageUrl,
        t: q.questionType,
        o: q.options,
        a: q.correctAnswer,
        e: q.explanation,
        c: q.category,
        cog: q.cognitiveLevel,
        w: q.scoreWeight,
        ind: q.competencyIndicator,
      })),
    };
    const jsonStr = JSON.stringify(compact);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('Failed to encode exam for student URL:', err);
    return '';
  }
}

/**
 * Decodes a URL-safe Base64 string back into a full Exam object.
 */
export function decodeExamPayload(encoded: string): Exam | null {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const compact = JSON.parse(jsonStr);
    if (!compact || !compact.c || !Array.isArray(compact.q)) return null;

    return {
      id: compact.id || `exam-${Date.now()}`,
      code: compact.c,
      title: compact.t || 'Ujian Online',
      subject: compact.s || 'Umum',
      grade: compact.g || 'Umum',
      examType: compact.tp || 'Penilaian Akhir Bab',
      token: compact.k || '',
      durationMinutes: compact.d || 30,
      isActive: true,
      createdAt: new Date().toISOString(),
      questions: compact.q.map((q: any, idx: number) => ({
        id: q.id || `q-${idx + 1}`,
        number: q.n !== undefined ? q.n : idx + 1,
        question: q.q || '',
        imageUrl: q.img,
        questionType: q.t || 'pilihan_ganda',
        options: q.o || { a: '', b: '', c: '', d: '' },
        correctAnswer: q.a || 'a',
        explanation: q.e || '',
        category: q.c || '',
        cognitiveLevel: q.cog || 'C2',
        scoreWeight: q.w || 1,
        competencyIndicator: q.ind || '',
      })),
    };
  } catch (err) {
    console.warn('Failed to decode exam from URL:', err);
    return null;
  }
}

/**
 * Builds the complete shareable student link with embedded exam data
 * and optional Google Drive file ID.
 */
export function buildStudentExamUrl(exam: Exam, driveFileId?: string): string {
  try {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = new URL(origin + pathname);
    url.searchParams.set('mode', 'siswa');
    url.searchParams.set('examCode', exam.code);
    if (exam.token) {
      url.searchParams.set('token', exam.token);
    }
    if (driveFileId) {
      url.searchParams.set('driveId', driveFileId);
    }
    const payload = encodeExamPayload(exam);
    if (payload) {
      url.searchParams.set('p', payload);
    }
    return url.toString();
  } catch {
    return `${window.location.origin}/?mode=siswa&examCode=${encodeURIComponent(exam.code)}`;
  }
}
