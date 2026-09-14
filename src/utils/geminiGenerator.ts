import { GoogleGenAI, Type } from '@google/genai';
import { Question, QuestionType, ExamType } from '../types';
import { EDUCATIONAL_IMAGE_PRESETS } from '../initialData';
import { safeFetchJson } from './apiHelper';

export const CUSTOM_API_KEY_STORAGE_KEY = 'cbt_custom_gemini_api_key';

export interface GenerateExamParams {
  topic: string;
  subject: string;
  grade: string;
  count: number;
  difficulty: string;
  questionType: QuestionType | 'campuran';
  examType: ExamType;
}

export interface ApiVerificationResult {
  active: boolean;
  source: 'server' | 'custom' | 'none';
  model?: string;
  latencyMs?: number;
  message: string;
  error?: string;
  hasServerKey?: boolean;
}

/**
 * Get active custom API Key from browser localStorage or VITE environment variable
 */
export function getStoredGeminiApiKey(): string {
  try {
    const custom = localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY);
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch {
    // Ignore localStorage access errors
  }
  const viteEnvKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (viteEnvKey && typeof viteEnvKey === 'string' && viteEnvKey.trim()) {
    return viteEnvKey.trim();
  }
  return '';
}

/**
 * Save custom Gemini API Key into browser localStorage
 */
export function saveStoredGeminiApiKey(key: string): void {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(CUSTOM_API_KEY_STORAGE_KEY);
    } else {
      localStorage.setItem(CUSTOM_API_KEY_STORAGE_KEY, key.trim());
    }
  } catch (err) {
    console.warn('Failed to save Gemini API key in localStorage:', err);
  }
}

/**
 * Remove custom Gemini API Key from browser localStorage
 */
export function clearStoredGeminiApiKey(): void {
  try {
    localStorage.removeItem(CUSTOM_API_KEY_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear Gemini API key from localStorage:', err);
  }
}

/**
 * Verify if Gemini API is active, working, and valid.
 * Checks both server-side backend (if available) and client-side fallback (for Firebase static deployments).
 */
export async function verifyGeminiApiKey(customApiKeyToTest?: string): Promise<ApiVerificationResult> {
  const activeCustomKey = customApiKeyToTest !== undefined ? customApiKeyToTest.trim() : getStoredGeminiApiKey();

  // 1. Try checking via backend endpoint first
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (activeCustomKey) {
      headers['x-gemini-api-key'] = activeCustomKey;
    }

    const res = await safeFetchJson<any>('/api/gemini/status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ apiKey: activeCustomKey }),
    }, 0);

    if (res.ok && res.data) {
      return {
        active: Boolean(res.data.active),
        source: res.data.source || (activeCustomKey ? 'custom' : 'server'),
        model: res.data.model || 'gemini-3.8-flash',
        latencyMs: res.data.latencyMs,
        message: res.data.message || (res.data.active ? 'Koneksi Gemini AI berhasil terhubung.' : 'Verifikasi gagal.'),
        error: res.data.error,
        hasServerKey: res.data.hasServerKey,
      };
    }

    // If backend returned non-404 error with valid JSON
    if (res.data && res.data.error) {
      return {
        active: false,
        source: activeCustomKey ? 'custom' : 'server',
        message: res.data.message || res.data.error,
        error: res.data.error,
        hasServerKey: res.data.hasServerKey,
      };
    }
  } catch (err) {
    console.warn('Backend status check failed, falling back to direct client ping:', err);
  }

  // 2. If backend returned 404 (e.g. Firebase static deployment) or server is unreachable, test directly on client
  if (!activeCustomKey) {
    return {
      active: false,
      source: 'none',
      message: 'Kunci Gemini API belum diatur. Masukkan kunci API Anda untuk mengaktifkan AI di browser.',
      hasServerKey: false,
    };
  }

  const startTime = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: activeCustomKey });
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let workingModel = '';
    let lastErr: any = null;

    for (const m of modelsToTry) {
      try {
        const ping = await ai.models.generateContent({
          model: m,
          contents: 'Jawab 1 kata: Siap',
        });
        if (ping.text) {
          workingModel = m;
          break;
        }
      } catch (err: any) {
        lastErr = err;
      }
    }

    const latencyMs = Date.now() - startTime;

    if (workingModel) {
      return {
        active: true,
        source: 'custom',
        model: workingModel,
        latencyMs,
        message: `Koneksi Gemini AI Valid! Model ${workingModel} aktif di peramban Anda (Latensi: ${latencyMs}ms).`,
        hasServerKey: false,
      };
    } else {
      const errMsg = lastErr?.message || String(lastErr || 'Kunci API tidak valid');
      return {
        active: false,
        source: 'custom',
        message: `Kunci API tidak valid atau kuota habis: ${errMsg}`,
        error: errMsg,
        hasServerKey: false,
      };
    }
  } catch (err: any) {
    return {
      active: false,
      source: 'custom',
      message: `Gagal memverifikasi API Key: ${err?.message || 'Format kunci salah'}`,
      error: err?.message,
      hasServerKey: false,
    };
  }
}

/**
 * Client-Side Gemini Generator Fallback.
 * Used when backend server returns 404 (e.g. on Firebase static hosting)
 * or when direct client generation is requested.
 */
async function generateQuestionsClientSide(
  params: GenerateExamParams,
  apiKey: string
): Promise<Question[]> {
  const { topic, subject, grade, count, difficulty, questionType, examType } = params;
  const ai = new GoogleGenAI({ apiKey });

  const safeCount = Math.min(50, Math.max(1, Number(count) || 5));

  let typeGuideline = '';
  if (questionType === 'pilihan_ganda') {
    typeGuideline = `Seluruh soal harus berbentuk Pilihan Ganda dengan 4 pilihan (a, b, c, d) dan 1 jawaban benar mutlak. correctAnswer harus berupa salah satu dari 'a', 'b', 'c', atau 'd'.`;
  } else if (questionType === 'pilihan_ganda_kompleks') {
    typeGuideline = `Seluruh soal berbentuk Pilihan Ganda Kompleks (Multi-Jawaban). Berikan 4 pilihan (a, b, c, d) di mana terdapat 2 atau lebih jawaban yang benar. Sertakan 'correctAnswers' berupa array huruf kecil (contoh: ["a", "c"]). 'correctAnswer' diisi huruf pertama jawaban benar.`;
  } else if (questionType === 'benar_salah') {
    typeGuideline = `Seluruh soal berbentuk Benar / Salah. Teks pertanyaan menyajikan stimulus dan sebuah pernyataan logis. options a diisi "Benar" dan options b diisi "Salah" (options c dan d beri "-"). correctAnswer diisi "a" jika pernyataan Benar, atau "b" jika Salah.`;
  } else if (questionType === 'isian_singkat') {
    typeGuideline = `Seluruh soal berbentuk Isian Singkat. Pertanyaan menguji istilah, rumus, nama konsep, atau angka penting. options beri teks alternatif pengecoh singkat, correctAnswer diisi kata kunci atau jawaban eksak singkat (1-3 kata).`;
  } else if (questionType === 'uraian') {
    typeGuideline = `Seluruh soal berbentuk Soal Uraian / Essay Terbuka yang mendalam. options beri aspek penilaian (a: Aspek Pemahaman, b: Analisis, c: Solusi, d: Kesimpulan), correctAnswer diisi ringkasan jawaban inti, dan explanation diisi rubrik penilaian lengkap beserta poin-poin jawaban yang diharapkan.`;
  } else {
    typeGuideline = `Variasikan butir soal dengan proporsi: sebagian Pilihan Ganda (PG), sebagian Benar/Salah, dan sebagian Isian Singkat.`;
  }

  const matchingPreset = EDUCATIONAL_IMAGE_PRESETS.find(
    (p) =>
      p.category.toLowerCase().includes(subject.toLowerCase()) ||
      subject.toLowerCase().includes(p.category.toLowerCase())
  );

  const generateSingleBatch = async (batchCount: number, batchOffset: number): Promise<any[]> => {
    const prompt = `Anda adalah pakar pembuat instrumen asesmen dan kisi-kisi naskah ujian standar Kurikulum Merdeka Indonesia dan Taksonomi Bloom & Anderson.
Tugas Anda adalah merumuskan butir naskah soal berkualitas tinggi untuk:
- Jenis Ujian: ${examType}
- Mata Pelajaran: ${subject}
- Jenjang / Tingkat Kelas: ${grade || 'Semua Jenjang (SD, SMP, atau SMA/SMK)'}
- Topik / Instruksi Pembagian Bentuk Soal: ${topic}
- Tingkat Kesulitan: ${difficulty}
- Pilihan Bentuk Soal: ${questionType} (${typeGuideline})
- Jumlah Butir Soal untuk bagian ini: ${batchCount} soal (Mulai butir #${batchOffset + 1})

PANDUAN TAKSONOMI BLOOM & ANDERSON (C1 - C6):
- Setiap butir soal WAJIB ditentukan level kognitifnya: C1 (Mengingat), C2 (Memahami), C3 (Menerapkan), C4 (Menganalisis), C5 (Mengevaluasi), atau C6 (Mencipta).
- Berikan deskripsi level kognitif pada 'cognitiveDescription' (contoh: "C4 - Menganalisis hubungan sebab-akibat").
- Tuliskan indikator pencapaian kompetensi pada 'competencyIndicator'.

PANDUAN PENSKORAN & KATA KUNCI:
- Untuk soal 'isian_singkat' dan 'uraian', sertakan 2-5 kata kunci penting (field 'keywords') untuk penskoran otomatis AI!
- Berikan bobot skor (field 'scoreWeight'): PG = 1, Isian = 2, Uraian = 4.
- Berikan rubrik penskoran pada field 'rubricGuide'.

Format Output: HANYA JSON array sesuai responseSchema tanpa format markdown block.`;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastErr: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: 'Teks pertanyaan lengkap beserta stimulus' },
                  questionType: { type: Type.STRING, description: 'pilihan_ganda, isian_singkat, uraian, pilihan_ganda_kompleks, atau benar_salah' },
                  cognitiveLevel: { type: Type.STRING, description: 'C1, C2, C3, C4, C5, atau C6' },
                  cognitiveDescription: { type: Type.STRING, description: 'Deskripsi level kognitif' },
                  competencyIndicator: { type: Type.STRING, description: 'Indikator capaian soal' },
                  scoreWeight: { type: Type.NUMBER, description: 'Bobot skor butir soal' },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Kata kunci penskoran AI' },
                  rubricGuide: { type: Type.STRING, description: 'Panduan rubrik penskoran' },
                  options: {
                    type: Type.OBJECT,
                    properties: {
                      a: { type: Type.STRING, description: 'Opsi A' },
                      b: { type: Type.STRING, description: 'Opsi B' },
                      c: { type: Type.STRING, description: 'Opsi C' },
                      d: { type: Type.STRING, description: 'Opsi D' },
                    },
                    required: ['a', 'b', 'c', 'd'],
                  },
                  correctAnswer: { type: Type.STRING, description: 'Kunci jawaban utama' },
                  correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array kunci jawaban benar jika PG kompleks' },
                  explanation: { type: Type.STRING, description: 'Pembahasan konsep edukatif' },
                  category: { type: Type.STRING, description: 'Materi pokok atau subtopik' },
                },
                required: ['question', 'questionType', 'options', 'correctAnswer', 'explanation', 'cognitiveLevel'],
              },
            },
          },
        });

        const rawText = response.text || '[]';
        const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (err: any) {
        lastErr = err;
        const errMsg = String(err?.message || err || '');
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
          console.warn(`Model ${modelName} high demand on client, shifting to next fallback model...`);
          continue;
        }
        console.warn(`Client attempt with ${modelName} failed:`, errMsg);
      }
    }

    if (lastErr) throw lastErr;
    return [];
  };

  const BATCH_SIZE = 10;
  const batchSizes: number[] = [];
  let remaining = safeCount;
  while (remaining > 0) {
    const current = Math.min(remaining, BATCH_SIZE);
    batchSizes.push(current);
    remaining -= current;
  }

  let offset = 0;
  const results: any[][] = [];
  for (let i = 0; i < batchSizes.length; i++) {
    const size = batchSizes[i];
    const batchRes = await generateSingleBatch(size, offset);
    offset += size;
    results.push(batchRes);
    if (i < batchSizes.length - 1) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const questionsRaw = results.flat();
  const formattedQuestions: Question[] = questionsRaw.map((q, idx) => {
    let resolvedType: QuestionType = 'pilihan_ganda';
    if (q.questionType === 'isian_singkat') resolvedType = 'isian_singkat';
    else if (q.questionType === 'uraian') resolvedType = 'uraian';
    else if (q.questionType === 'benar_salah') resolvedType = 'benar_salah';
    else if (q.questionType === 'pilihan_ganda_kompleks') resolvedType = 'pilihan_ganda_kompleks';

    const cleanNumber = idx + 1;
    const defaultWeight = resolvedType === 'uraian' ? 4 : resolvedType === 'isian_singkat' ? 2 : 1;

    return {
      id: `q-client-${Date.now()}-${idx}`,
      number: cleanNumber,
      question: q.question || `Soal nomor ${cleanNumber}`,
      questionType: resolvedType,
      imageUrl: matchingPreset ? matchingPreset.url : undefined,
      cognitiveLevel: q.cognitiveLevel || 'C2',
      cognitiveDescription: q.cognitiveDescription || `${q.cognitiveLevel || 'C2'} - Tingkat kognitif materi`,
      competencyIndicator: q.competencyIndicator || `Siswa mampu memahami materi pokok ${subject}`,
      scoreWeight: Number(q.scoreWeight) || defaultWeight,
      keywords: Array.isArray(q.keywords) ? q.keywords : undefined,
      rubricGuide: q.rubricGuide || undefined,
      options: {
        a: q.options?.a || 'Pilihan A',
        b: q.options?.b || 'Pilihan B',
        c: q.options?.c || 'Pilihan C',
        d: q.options?.d || 'Pilihan D',
      },
      correctAnswer: q.correctAnswer || 'a',
      correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers : undefined,
      explanation: q.explanation || 'Pembahasan soal.',
      category: q.category || topic,
    };
  });

  return formattedQuestions;
}

/**
 * Universal Question Generation Function with Auto-Fallback.
 * 1. Tries Backend API (/api/gemini/generate-questions) first, with custom API key if present.
 * 2. If Backend returns 404 (e.g. Firebase static deployment where server.ts is not running) or network drops,
 *    it automatically switches to Client-Side Generation using the stored key.
 * 3. If neither backend nor client key is available, provides an actionable, user-friendly error message.
 */
export async function generateExamQuestionsWithFallback(
  params: GenerateExamParams
): Promise<{ questions: Question[]; generatedVia: 'server' | 'client' }> {
  const customKey = getStoredGeminiApiKey();

  // Try Server API first
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) {
    headers['x-gemini-api-key'] = customKey;
  }

  const serverResponse = await safeFetchJson<any>(
    '/api/gemini/generate-questions',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...params,
        customApiKey: customKey || undefined,
      }),
    },
    0
  );

  // If server succeeded
  if (serverResponse.ok && serverResponse.data?.success && Array.isArray(serverResponse.data?.questions)) {
    return {
      questions: serverResponse.data.questions,
      generatedVia: 'server',
    };
  }

  // If server returned 404 (common on Firebase static deployments) OR connection failed
  const is404 = serverResponse.status === 404;
  const isServerlessOrOffline = !serverResponse.ok && (is404 || serverResponse.status === 0 || serverResponse.status >= 500);

  if (isServerlessOrOffline) {
    console.info(`[Gemini Generator] Server returned status ${serverResponse.status}. Switching to Client-Side AI Fallback...`);

    if (customKey) {
      try {
        const clientQuestions = await generateQuestionsClientSide(params, customKey);
        if (clientQuestions.length > 0) {
          return {
            questions: clientQuestions,
            generatedVia: 'client',
          };
        }
      } catch (clientErr: any) {
        throw new Error(`Pembuatan soal via Client AI gagal: ${clientErr.message || clientErr}`);
      }
    } else {
      // Missing API key in Firebase Hosting static environment
      throw new Error(
        `Backend server tidak terdeteksi di Firebase Hosting statis dan GEMINI_API_KEY belum dikonfigurasi di browser. Silakan buka menu "Pengaturan & API Key" untuk memasukkan Gemini API Key gratis Anda agar fitur generate soal langsung aktif.`
      );
    }
  }

  // If server returned a specific error (e.g. 400 Bad Request or validation error)
  const errorMsg = serverResponse.error || serverResponse.data?.error || 'Gagal memanggil layanan Gemini AI.';
  throw new Error(errorMsg);
}
