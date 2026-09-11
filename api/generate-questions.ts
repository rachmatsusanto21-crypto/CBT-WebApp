import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-api-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const customKey =
      (req.headers['x-gemini-api-key'] as string) ||
      req.body?.customApiKey;

    const activeKey = customKey || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      res.status(400).json({
        error: 'GEMINI_API_KEY tidak ditemukan di environment Vercel. Silakan atur di Project Settings Vercel atau simpan di menu Pengaturan aplikasi.',
        needsApiKey: true,
      });
      return;
    }

    const {
      topic,
      grade,
      subject = 'Umum',
      count = 5,
      difficulty = 'Sedang',
      questionType = 'pilihan_ganda',
      examType = 'Penilaian Akhir Bab',
    } = req.body || {};

    if (!topic) {
      res.status(400).json({ error: 'Topik atau kisi-kisi soal wajib diisi' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build-vercel' } },
    });

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

    const prompt = `Anda adalah pakar pembuat instrumen asesmen dan kisi-kisi naskah ujian standar Kurikulum Merdeka Indonesia dan Taksonomi Bloom & Anderson.
Tugas Anda adalah merumuskan butir naskah soal berkualitas tinggi untuk:
- Jenis Ujian: ${examType}
- Mata Pelajaran: ${subject}
- Jenjang / Tingkat Kelas: ${grade || 'Semua Jenjang (SD, SMP, atau SMA/SMK)'}
- Topik / Instruksi Pembagian Bentuk Soal: ${topic}
- Tingkat Kesulitan: ${difficulty}
- Pilihan Bentuk Soal: ${questionType} (${typeGuideline})
- Jumlah Butir Soal untuk bagian ini: ${safeCount} soal

PANDUAN TAKSONOMI BLOOM & ANDERSON (C1 - C6):
- Setiap butir soal WAJIB ditentukan level kognitifnya: C1 (Mengingat), C2 (Memahami), C3 (Menerapkan), C4 (Menganalisis), C5 (Mengevaluasi), atau C6 (Mencipta).
- Berikan deskripsi level kognitif pada 'cognitiveDescription'.
- Tuliskan indikator pencapaian kompetensi pada 'competencyIndicator'.
- Bobot skor ('scoreWeight'): PG = 1, Isian = 2, Uraian = 4.

Format Output: HANYA JSON array sesuai responseSchema tanpa format markdown block.`;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastErr: any = null;
    let questionsRaw: any[] = [];

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
                  question: { type: Type.STRING },
                  questionType: { type: Type.STRING },
                  cognitiveLevel: { type: Type.STRING },
                  cognitiveDescription: { type: Type.STRING },
                  competencyIndicator: { type: Type.STRING },
                  scoreWeight: { type: Type.NUMBER },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  rubricGuide: { type: Type.STRING },
                  options: {
                    type: Type.OBJECT,
                    properties: {
                      a: { type: Type.STRING },
                      b: { type: Type.STRING },
                      c: { type: Type.STRING },
                      d: { type: Type.STRING },
                    },
                    required: ['a', 'b', 'c', 'd'],
                  },
                  correctAnswer: { type: Type.STRING },
                  correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
                  explanation: { type: Type.STRING },
                  category: { type: Type.STRING },
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
          questionsRaw = parsed;
          break;
        }
      } catch (err: any) {
        lastErr = err;
        const errMsg = String(err?.message || err || '');
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
          continue;
        }
      }
    }

    if (questionsRaw.length === 0 && lastErr) {
      throw lastErr;
    }

    const formattedQuestions = questionsRaw.map((q, idx) => ({
      id: `q-vercel-${Date.now()}-${idx}`,
      number: idx + 1,
      question: q.question,
      questionType: q.questionType || 'pilihan_ganda',
      cognitiveLevel: q.cognitiveLevel || 'C2',
      cognitiveDescription: q.cognitiveDescription || `${q.cognitiveLevel || 'C2'} - Kognitif`,
      competencyIndicator: q.competencyIndicator || `Kompetensi dasar ${subject}`,
      scoreWeight: Number(q.scoreWeight) || 1,
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
      explanation: q.explanation || 'Pembahasan',
      category: q.category || topic,
    }));

    res.status(200).json({
      success: true,
      count: formattedQuestions.length,
      questions: formattedQuestions,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Gagal memproses pembuatan butir soal dengan Gemini AI di Vercel.',
    });
  }
}
