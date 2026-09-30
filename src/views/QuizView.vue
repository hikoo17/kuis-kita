<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft } from '@lucide/vue'

import { useQuiz, isAnswering } from '@/composables/useQuiz'
import { useStudents } from '@/composables/useStudents'
import { useQuestions, ALL_SUBJECTS } from '@/composables/useQuestions'
import { useSubjects } from '@/composables/useSubjects'
import { useSubjectScores } from '@/composables/useSubjectScores'
import { useClasses } from '@/composables/useClasses'
import { useQuizSessions } from '@/composables/useQuizSessions'
import { useLeaderboard } from '@/composables/useLeaderboard'
import { useSettings } from '@/composables/useSettings'
import { useSound } from '@/composables/useSound'
import { useMusic } from '@/composables/useMusic'
import { useConfirm } from '@/composables/useConfirm'

import SubjectSelector from '@/components/SubjectSelector.vue'
import ClassSelector from '@/components/ClassSelector.vue'
import QuestionCard from '@/components/QuestionCard.vue'
import MultipleChoice from '@/components/MultipleChoice.vue'
import ShortAnswer from '@/components/ShortAnswer.vue'
import AnswerFeedback from '@/components/AnswerFeedback.vue'
import Leaderboard from '@/components/Leaderboard.vue'
import ScoreDisplay from '@/components/ScoreDisplay.vue'
import TurnCountdown from '@/components/TurnCountdown.vue'
import ConfettiBurst from '@/components/ConfettiBurst.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

const {
  students,
  isLoading: isLoadingStudents,
  error: studentsError,
  fetchStudents,
  resetClassScores,
} = useStudents()

const {
  questions: allQuestions,
  isLoading: isLoadingQuestions,
  error: questionsError,
  fetchQuestions,
} = useQuestions()

const {
  subjectList,
  isLoading: isLoadingSubjects,
  error: subjectsError,
  fetchSubjects,
} = useSubjects()

const {
  classList,
  isLoading: isLoadingClasses,
  error: classesError,
  needsMigration: classesNeedMigration,
  fetchClasses,
} = useClasses()

const { fetchSubjectScores } = useSubjectScores()
const { archiveSession } = useQuizSessions()

/**
 * Only subjects that actually have questions can be played.
 * (A newly created subject starts empty until the teacher adds questions.)
 */
const playableSubjects = computed(() => {
  const counts = {}
  allQuestions.value.forEach((question) => {
    const name = String(question.subject ?? '').trim()
    if (name) counts[name] = (counts[name] ?? 0) + 1
  })
  return subjectList.value.map((subject) => subject.name).filter((name) => counts[name] > 0)
})

const { leaderboardFor, startRealtime, stopRealtime } = useLeaderboard()
const { settings } = useSettings()
const { play } = useSound()
const { start: startMusic, stop: stopMusic } = useMusic()

// Sidebar board follows the class and material being played
// ('all' shows totals when "Semua Materi" is picked).
const sideLeaderboard = computed(() =>
  leaderboardFor(
    selectedSubject.value === ALL_SUBJECTS ? 'all' : selectedSubject.value,
    selectedClass.value?.id ?? null,
  ).value,
)

// Only students of the picked class can answer.
const classStudents = computed(() => {
  const classId = selectedClass.value?.id
  if (!classId) return []
  return students.value.filter((student) => student.class_id === classId)
})

const {
  stage,
  selectedClass,
  selectedStudent,
  selectedSubject,
  currentQuestion,
  currentQuestionNumber,
  totalQuestions,
  answerStatus,
  showFeedback,
  awardedPoints,
  streak,
  isSubmitting,
  error: quizError,
  isLastQuestion,
  displayOptions,
  selectClass,
  backToSubject,
  selectStudent,
  selectSubject,
  submitAnswer,
  tryAgain,
  nextQuestion,
  restart,
  timeLeft,
  isTimerRunning,
  startTimer,
  stopTimer,
} = useQuiz()

// Countdown overlay shown before answering.
// Appears after a subject is picked (game start) and again every time
// a student is picked to answer.
const showCountdown = ref(false)

// The option the student clicked, before pressing "KIRIM JAWABAN".
const pendingAnswer = ref('')
// Loading state of the quiz questions themselves.
const isLoadingQuiz = ref(false)
const shortAnswerRef = ref(null)

const currentStudent = computed(() => {
  const id = selectedStudent.value?.id
  if (!id) return null
  return students.value.find((student) => student.id === id) ?? selectedStudent.value
})

const subjectLabel = computed(() =>
  selectedSubject.value === ALL_SUBJECTS ? 'Semua Materi' : selectedSubject.value,
)

const progressBarPercent = computed(() => {
  if (totalQuestions.value === 0) return 0
  return Math.round((currentQuestionNumber.value / totalQuestions.value) * 100)
})

const isMultipleChoice = computed(() => currentQuestion.value?.type === 'multiple_choice')
const isRevealed = computed(() => ['correct', 'wrong', 'timeout'].includes(answerStatus.value))

// Clear the pending choice whenever a question is reset or a new one starts.
watch([() => currentQuestion.value?.id, answerStatus], () => {
  if (answerStatus.value === 'idle') pendingAnswer.value = ''
})

async function onSelectSubject(subject) {
  play('start')
  isLoadingQuiz.value = true
  await selectSubject(subject)
  isLoadingQuiz.value = false
  if (totalQuestions.value > 0) {
    // Game start: count down right after the subject is picked.
    showCountdown.value = true
  }
}

function onSelectClass(schoolClass) {
  play('select')
  selectClass(schoolClass)
}

function onSelectStudent(student) {
  play('select')
  selectStudent(student)
  // Tampilkan hitung mundur lagi setiap kali siswa dipilih.
  showCountdown.value = true
}

function onCountdownDone() {
  showCountdown.value = false
  if (!selectedStudent.value) {
    // Subject countdown done: game started, waiting for the first pick.
    // No music, no timer yet — nobody is answering.
    stopTimer()
    return
  }
  startTimer()
}

/** Timeout overlay -> same question, another student may try it. */
function onTimeoutChangeStudent() {
  onRetry()
}

function onSelectOption(label) {
  if (answerStatus.value !== 'idle' || isSubmitting.value) return
  pendingAnswer.value = label
  play('click')
}

async function onSubmitOption() {
  if (!pendingAnswer.value) return
  await submitAnswer(pendingAnswer.value)
}

async function onSubmitShortAnswer(value) {
  await submitAnswer(value)
}

function onRetry() {
  // Same question, but a student must be picked again to answer it.
  pendingAnswer.value = ''
  shortAnswerRef.value?.reset()
  tryAgain()
  selectedStudent.value = null
  stopTimer()
  play('retry')
}

function onNext() {
  pendingAnswer.value = ''
  nextQuestion()
  play('next')
}

// Hasil akhir (snapshot) + arsip otomatis saat kuis selesai.
// Snapshot diambil SEBELUM skor kelas dinol-kan supaya papan hasil tetap benar.
const finishedResults = ref([])
const isFinishing = ref(false)
const hasArchived = ref(false)

function captureFinishedResults() {
  const classId = selectedClass.value?.id ?? null
  const roster = classId
    ? students.value.filter((student) => student.class_id === classId)
    : [...students.value]

  finishedResults.value = [...roster].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
  })
}

/**
 * Arsipkan sesi yang benar-benar selesai, lalu nol-kan skor kelas untuk game
 * berikutnya. Hanya dipanggil saat soal terakhir sudah lewat (stage 'finished'),
 * jadi sesi yang belum selesai tidak pernah tersimpan.
 */
async function archiveFinishedSession() {
  if (hasArchived.value || isFinishing.value) return
  if (totalQuestions.value === 0) return

  // Kelas tanpa siswa: tidak ada yang perlu diarsipkan. Tandai sudah "beres"
  // supaya tombol Kembali tidak mencoba menyimpan berulang kali.
  if (finishedResults.value.length === 0) {
    hasArchived.value = true
    return
  }

  isFinishing.value = true
  try {
    const classId = selectedClass.value?.id ?? null

    await archiveSession({
      className: selectedClass.value?.name ?? 'Tanpa Kelas',
      subjectLabel: subjectLabel.value,
      questionCount: totalQuestions.value,
      entries: finishedResults.value.map((student) => ({
        student_name: student.name,
        score: student.score,
      })),
    })
    if (classId) await resetClassScores(classId)

    hasArchived.value = true
  } catch (err) {
    quizError.value = err.message || 'Hasil belum berhasil disimpan. Silakan coba lagi.'
  } finally {
    isFinishing.value = false
  }
}

/** Tombol "Kembali" di layar hasil: pastikan tersimpan, lalu balik ke awal. */
async function onFinishBack() {
  if (!hasArchived.value) {
    await archiveFinishedSession()
    // Kalau arsip gagal, tetap di layar hasil supaya guru bisa coba lagi.
    if (!hasArchived.value) return
  }
  closeFinished()
}

/** Balik ke pemilihan kelas. */
function closeFinished() {
  pendingAnswer.value = ''
  showCountdown.value = false
  finishedResults.value = []
  hasArchived.value = false
  restart()
  stopMusic()
  play('click')
}

/** Back to subject selection (e.g. the wrong subject was picked). */
function onBackToSubject() {
  pendingAnswer.value = ''
  backToSubject()
  stopMusic()
  play('click')
}

// Keluar di tengah kuis membuang game yang belum selesai, jadi minta konfirmasi dulu.
const { confirmState, askConfirm, runConfirm, cancelConfirm } = useConfirm()

function requestBackToSubject() {
  askConfirm(
    {
      title: 'Tinggalkan Kuis?',
      message:
        'Kuis yang sedang berjalan belum selesai dan tidak akan tersimpan di Riwayat. ' +
        'Yakin ingin kembali ke pilihan materi?',
      confirmLabel: 'Ya, Kembali',
      cancelLabel: 'Lanjut Main',
      variant: 'danger',
    },
    onBackToSubject,
  )
}

// Pintasan papan tombol untuk tampilan proyektor.
function onQuizKeydown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
  if (confirmState.open) return

  const tag = event.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
    return
  }

  const key = event.key

  // Pilih item ke-1..9 dari sebuah daftar.
  const pickByNumber = (list, handler) => {
    const index = Number(key) - 1
    if (Number.isInteger(index) && index >= 0 && index < Math.min(list.length, 9)) {
      event.preventDefault()
      handler(list[index])
      return true
    }
    return false
  }

  if (stage.value === 'class') {
    pickByNumber(classList.value, onSelectClass)
    return
  }

  if (stage.value === 'subject') {
    if (key === '0' || key.toLowerCase() === 'a') {
      event.preventDefault()
      onSelectSubject(ALL_SUBJECTS)
      return
    }
    pickByNumber(playableSubjects.value, onSelectSubject)
    return
  }

  if (stage.value !== 'quiz' || showCountdown.value) return

  // Belum ada yang menjawab: pilih siswa dengan angka 1..9.
  if (!selectedStudent.value) {
    pickByNumber(classStudents.value, onSelectStudent)
    return
  }

  // Umpan balik tampil: Enter / Spasi / panah kanan untuk lanjut.
  if (showFeedback.value) {
    if (key === 'Enter' || key === ' ' || key === 'ArrowRight') {
      event.preventDefault()
      onNext()
    }
    return
  }

  // Pilihan ganda: jawaban hanya dipilih lewat klik/tap.
  // Pintasan papan tombol sengaja tidak ada (baik huruf A-D maupun angka 1-4),
  // supaya tidak bentrok saat pilihan jawaban lebih dari 4.

  // Enter: kirim jawaban yang sudah dipilih (pilihan ganda).
  if (key === 'Enter' && isMultipleChoice.value && pendingAnswer.value) {
    event.preventDefault()
    onSubmitOption()
  }
}

/** Back to class selection (e.g. the wrong class was picked). */
function onBackToClass() {
  pendingAnswer.value = ''
  restart()
  stopMusic()
  play('click')
}

// Musik latar mengikuti fase permainan:
// - setelah materi dipilih (kelas berpikir) → track "menu"
// - saat hitung mundur muncul          → senyap dulu
// - saat sesi menjawab berlangsung      → track "game"
// - saat menampilkan umpan balik        → senyap
function musicMode() {
  if (stage.value !== 'quiz' || showCountdown.value) return null
  if (!selectedStudent.value) return 'menu'
  return answerStatus.value === 'idle' ? 'game' : null
}

watch(
  [stage, selectedStudent, showCountdown, answerStatus, () => settings.value.musicEnabled],
  () => {
    const mode = musicMode()
    isAnswering.value = mode !== null
    if (!settings.value.musicEnabled) {
      stopMusic()
      return
    }
    if (mode) startMusic(mode)
    else stopMusic()
  },
)

watch(stage, (value) => {
  if (value === 'finished') {
    play('finish')
    // Jump to the top so the finish animation is visible right away.
    window.scrollTo({ top: 0, behavior: 'auto' })
    // Sesi benar-benar selesai: ambil hasil lalu arsipkan otomatis.
    captureFinishedResults()
    archiveFinishedSession()
  }
})

onMounted(async () => {
  await Promise.all([fetchStudents(), fetchQuestions(), fetchSubjects(), fetchSubjectScores(), fetchClasses()])
  startRealtime()
  document.addEventListener('keydown', onQuizKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onQuizKeydown)
  stopRealtime()
  stopMusic()
  stopTimer()
  isAnswering.value = false
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-6 lg:py-8">
    <!-- ============================== HEADER ============================== -->
    <div v-if="stage === 'quiz'" class="mb-6 flex items-center justify-between gap-4">
      <button
        type="button"
        class="btn-neutral !px-4 !py-2 !text-base shadow-card ring-0 hover:shadow-card-hover"
        title="Kembali untuk ganti materi"
        @click="requestBackToSubject"
      >
        <ArrowLeft :size="18" aria-hidden="true" />
        Kembali
      </button>
      <p v-if="selectedClass" class="chip bg-white !px-4 !py-2 !text-base text-slate-900 shadow-card">
        {{ selectedClass.name }}
      </p>
    </div>

    <section v-if="stage === 'quiz'" class="mb-6 rounded-3xl bg-white p-5 shadow-card">
      <div class="flex flex-wrap items-center gap-4">
        <div>
          <p class="text-xs font-extrabold tracking-[0.2em] text-brand-600">Kuis Kelas</p>
          <h1 class="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {{ subjectLabel }}
          </h1>
        </div>

        <div class="ms-auto flex flex-wrap items-center gap-4">
          <div class="text-right">
            <p class="text-xs font-bold tracking-widest text-slate-400">Progres</p>
            <p class="text-lg font-extrabold text-slate-800">
              Soal {{ currentQuestionNumber }} dari {{ totalQuestions }}
            </p>
          </div>
          <ScoreDisplay v-if="currentStudent" :streak="streak" />
        </div>
      </div>

      <div class="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500"
          :style="{ width: progressBarPercent + '%' }"
        />
      </div>

      <p class="mt-3 text-xs font-semibold text-slate-400">
        Pintasan keyboard: <span class="text-slate-500">A–D / 1–4</span> pilih jawaban ·
        <span class="text-slate-500">Enter</span> kirim · <span class="text-slate-500">Spasi</span> lanjut ·
        <span class="text-slate-500">F</span> layar penuh
      </p>
    </section>

    <!-- =============================== ERROR =============================== -->
    <div
      v-if="quizError || studentsError || questionsError || subjectsError"
      class="mb-6 rounded-3xl bg-red-50 p-5 text-center ring-1 ring-red-200"
    >
      <p class="text-2xl" aria-hidden="true">⚠️</p>
      <p class="mt-1 text-lg font-semibold text-red-700">
        {{ quizError || studentsError || questionsError || subjectsError }}
      </p>
    </div>

    <!-- =========================== PILIH KELAS =========================== -->
    <div
      v-if="classesNeedMigration"
      class="mb-6 rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200"
    >
      <p class="font-extrabold text-amber-700">⚠️ Tabel kelas belum tersedia</p>
      <p class="mt-1 text-amber-700">
        Jalankan file <span class="font-bold">supabase/migration_classes.sql</span> di SQL Editor
        Supabase untuk mengaktifkan kuis per kelas.
      </p>
    </div>

    <ClassSelector
      v-if="stage === 'class'"
      :classes="classList"
      :is-loading="isLoadingClasses"
      :error="classesError"
      @select="onSelectClass"
    />

    <!-- =========================== PILIH MATERI =========================== -->
    <template v-else-if="stage === 'subject'">
      <SubjectSelector
        :subjects="playableSubjects"
        :is-loading="isLoadingQuestions || isLoadingSubjects"
        :error="questionsError || subjectsError"
        @select="onSelectSubject"
        @back="onBackToClass"
      />
    </template>

    <!-- =============================== SOAL =============================== -->
    <div v-else-if="stage === 'quiz'" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <div v-if="isLoadingQuiz" class="card text-center">
          <div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"></div>
          <p class="mt-4 text-lg font-semibold text-slate-500">Memuat...</p>
        </div>

        <QuestionCard
          v-if="!isLoadingQuiz && currentQuestion"
          :question="currentQuestion"
          :question-number="currentQuestionNumber"
          :total-questions="totalQuestions"
          :time-left="isTimerRunning ? timeLeft : null"
        >
          <!-- Pilihan ganda selalu terlihat supaya kelas bisa ikut berpikir;
               baru bisa diklik setelah siswa dipilih. -->
          <MultipleChoice
            v-if="isMultipleChoice"
            :key="currentQuestion.id"
            :options="displayOptions"
            :selected-answer="pendingAnswer"
            :correct-answer="currentQuestion.correct_answer"
            :revealed="isRevealed"
            :disabled="!selectedStudent || isSubmitting"
            @select="onSelectOption"
          />

          <template v-else-if="selectedStudent">
            <ShortAnswer
              :key="currentQuestion.id"
              ref="shortAnswerRef"
              :disabled="isRevealed"
              :is-loading="isSubmitting"
              @submit="onSubmitShortAnswer"
            />
          </template>

          <div v-if="isMultipleChoice && selectedStudent && !isRevealed" class="mt-6 text-center">
            <button
              type="button"
              class="btn-primary w-full px-10 py-5 text-xl sm:w-auto"
              :disabled="!pendingAnswer || isSubmitting"
              @click="onSubmitOption"
            >
              {{ isSubmitting ? 'Memeriksa...' : 'Kirim Jawaban' }}
            </button>
          </div>
        </QuestionCard>

        <!-- Picker siswa: kartu terpisah di bawah soal. -->
        <div
          v-if="!isLoadingQuiz && currentQuestion && !selectedStudent"
          class="card mt-6 animate-fade-in"
        >
          <p class="text-left text-xl font-extrabold text-slate-800 sm:text-2xl">
            Siapa yang ingin menjawab?
          </p>

          <div v-if="isLoadingStudents" class="mt-6 text-center text-lg font-semibold text-slate-500">
            Memuat...
          </div>

          <div v-else-if="classStudents.length === 0" class="mt-6 text-center">
            <p class="text-4xl" aria-hidden="true">❓</p>
            <p class="mt-2 font-bold text-slate-700">Belum Ada Siswa di Kelas Ini</p>
            <p class="text-slate-500">Tambahkan siswa ke kelas ini melalui Dashboard Guru.</p>
          </div>

          <div v-else class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              v-for="student in classStudents"
              :key="student.id"
              type="button"
              class="rounded-2xl bg-slate-50 px-4 py-4 text-lg font-extrabold text-slate-700 ring-1
                     ring-slate-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300
                     focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 active:scale-95"
              @click="onSelectStudent(student)"
            >
              {{ student.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Papan skor langsung, tampil di samping soal -->
      <aside class="lg:col-span-1">
        <div class="card">
          <h2 class="mb-4 text-center text-xl font-extrabold text-slate-900">🏆 Papan Skor</h2>
          <Leaderboard
            :students="sideLeaderboard"
            :limit="8"
            compact
            :highlight-id="currentStudent?.id ?? ''"
          />
        </div>
      </aside>
    </div>

    <!-- ============================= SELESAI ============================= -->
    <div v-else-if="stage === 'finished'" class="mx-auto max-w-3xl animate-fade-in">
      <div class="card relative overflow-hidden text-center">
        <ConfettiBurst :count="40" />
        <p class="text-6xl" aria-hidden="true">🎉</p>
        <h2 class="mt-3 text-3xl font-extrabold text-slate-900">Kuis Selesai!</h2>
        <p class="mt-2 text-lg text-slate-500">Terima kasih sudah bermain. Ini hasil akhirnya.</p>

        <div class="mt-8 text-left">
          <Leaderboard :students="finishedResults" :limit="10" />
        </div>

        <p v-if="isFinishing" class="mt-6 text-sm font-semibold text-slate-400">
          Menyimpan hasil ke riwayat...
        </p>

        <div class="mt-8 flex justify-center">
          <button
            type="button"
            class="btn-primary"
            :disabled="isFinishing"
            @click="onFinishBack"
          >
            <ArrowLeft :size="18" aria-hidden="true" />
            Kembali
          </button>
        </div>
      </div>
    </div>

    <!-- ============================= FEEDBACK ============================= -->
    <AnswerFeedback
      v-if="showFeedback && currentQuestion"
      :status="answerStatus"
      :student-name="currentStudent?.name ?? ''"
      :points="awardedPoints"
      :streak="streak"
      :is-last="isLastQuestion"
      @retry="onRetry"
      @next="onNext"
      @change="onTimeoutChangeStudent"
    />

    <!-- ============================= COUNTDOWN ============================= -->
    <TurnCountdown v-if="showCountdown" @done="onCountdownDone" />

    <!-- ===================== KONFIRMASI TINGGALKAN KUIS ===================== -->
    <ConfirmModal
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-label="confirmState.confirmLabel"
      :cancel-label="confirmState.cancelLabel"
      :variant="confirmState.variant"
      :is-loading="confirmState.loading"
      @confirm="runConfirm"
      @cancel="cancelConfirm"
    />
  </div>
</template>
