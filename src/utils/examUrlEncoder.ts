import { Exam } from '../types';

/**
 * Encodes an Exam into a URL-safe Base64 string.
 * Uses TextEncoder to safely support Indonesian characters, mathematical symbols, superscripts, etc.
 */
export function encodeExamPayload(exam: Exam, schoolName?: string): string {
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
      sch: schoolName || '',
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
export function decodeExamPayload(encoded: string): (Exam & { schoolName?: string }) | null {
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
      schoolName: compact.sch || undefined,
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

export const FIREBASE_HOSTING_URL = 'https://cbtwebapp-a5c83.web.app';
export const FIREBASE_ALT_HOSTING_URL = 'https://cbtwebapp-a5c83.firebaseapp.com';

/**
 * Gets the clean public base URL for student devices.
 * Uses the Firebase Hosting deployed URL (https://cbtwebapp-a5c83.web.app) as requested,
 * ensuring all shared student links connect directly to the Firebase-hosted application.
 */
export function getPublicBaseUrl(): string {
  try {
    const customUrl = localStorage.getItem('cbt_custom_app_url');
    if (customUrl && customUrl.trim().startsWith('http')) {
      return customUrl.trim().replace(/\/+$/, '');
    }

    const origin = window.location.origin;
    // If running on Firebase Hosting, retain current origin
    if (origin.includes('web.app') || origin.includes('firebaseapp.com')) {
      return origin.replace(/\/+$/, '');
    }

    // Default to official Firebase Hosting URL
    return FIREBASE_HOSTING_URL;
  } catch {
    return FIREBASE_HOSTING_URL;
  }
}

/**
 * Builds the ultra-clean, short shareable student link with exam code & token.
 * Uses query parameters with minimal length (~60-90 characters) so it NEVER triggers
 * "414 Request-URI Too Long" or proxy header size limits when shared via WhatsApp,
 * Classroom, or opened on mobile devices.
 */
export function buildStudentExamUrl(exam: Exam, driveFileId?: string, schoolName?: string): string {
  try {
    const baseUrl = getPublicBaseUrl();
    const url = new URL(baseUrl);
    url.pathname = '/';
    url.search = '';
    url.searchParams.set('mode', 'siswa');
    url.searchParams.set('examCode', (exam.code || '').trim());
    if (exam.token) {
      url.searchParams.set('token', exam.token.trim());
    }
    if (driveFileId) {
      url.searchParams.set('driveId', driveFileId.trim());
    }
    return url.toString();
  } catch {
    const base = getPublicBaseUrl();
    return `${base}/?mode=siswa&examCode=${encodeURIComponent((exam.code || '').trim())}${exam.token ? `&token=${encodeURIComponent(exam.token.trim())}` : ''}`;
  }
}

/**
 * Alternative offline/hash-based link generator.
 * Places any full payload in the URL HASH FRAGMENT (#) instead of query parameters (?).
 * By RFC 3986 HTTP specification, browsers NEVER transmit the '#' fragment to the web server,
 * making it physically impossible for the HTTP server to throw HTTP 414 "URI Too Long".
 */
export function buildHashBasedStudentExamUrl(exam: Exam, schoolName?: string): string {
  const base = getPublicBaseUrl();
  const payload = encodeExamPayload(exam, schoolName);
  return `${base}/?mode=siswa#p=${payload}&token=${encodeURIComponent(exam.token || '')}`;
}
