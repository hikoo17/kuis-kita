<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, UserCheck, Trophy, Sparkles, HelpCircle, Loader2 } from '@lucide/vue'

import { useQuiz, isAnswering, resolveTimeLimit } from '@/composables/useQuiz'
import { useStudents } from '@/composables/useStudents'
import { useQuestions } from '@/composables/useQuestions'
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
import InfoModal from '@/components/InfoModal.vue'

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

// Sidebar board follows the class and material being played.
const sideLeaderboard = computed(() =>
  leaderboardFor(selectedSubject.value, selectedClass.value?.id ?? null).value,
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

const showCountdown = ref(false)
const pendingAnswer = ref('')
const isLoadingQuiz = ref(false)
const shortAnswerRef = ref(null)

const currentStudent = computed(() => {
  const id = selectedStudent.value?.id
  if (!id) return null
  return students.value.find((student) => student.id === id) ?? selectedStudent.value
})

const subjectLabel = computed(() => selectedSubject.value)

const progressBarPercent = computed(() => {
  if (totalQuestions.value === 0) return 0
  return Math.round((currentQuestionNumber.value / totalQuestions.value) * 100)
})

const isMultipleChoice = computed(() => currentQuestion.value?.type === 'multiple_choice')
const isRevealed = computed(() => ['correct', 'wrong', 'timeout'].includes(answerStatus.value))

const effectiveTimeLimit = computed(() =>
  resolveTimeLimit(currentQuestion.value?.time_limit, settings.value.answerTimeLimit),
)

watch([() => currentQuestion.value?.id, answerStatus], () => {
  if (answerStatus.value === 'idle') pendingAnswer.value = ''
})

async function onSelectSubject(subject) {
  play('start')
  isLoadingQuiz.value = true
  await selectSubject(subject)
  isLoadingQuiz.value = false
  if (totalQuestions.value > 0) {
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
  showCountdown.value = true
}

function onCountdownDone() {
  showCountdown.value = false
  if (!selectedStudent.value) {
    stopTimer()
    return
  }
  startTimer()
}

function onTimeoutChangeStudent() {
  onRetry()
}

function onSelectOption(label) {
  if (answerStatus.value !== 'idle' || isSubmitting.value) return
  if (!selectedStudent.value) {
    showInfo(
      'Pilih Siswa Dulu',
      'Silakan pilih siswa yang ingin menjawab terlebih dahulu.',
    )
    return
  }
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

async function archiveFinishedSession() {
  if (hasArchived.value || isFinishing.value) return
  if (totalQuestions.value === 0) return

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

async function onFinishBack() {
  if (!hasArchived.value) {
    await archiveFinishedSession()
    if (!hasArchived.value) return
  }
  closeFinished()
}

function closeFinished() {
  pendingAnswer.value = ''
  showCountdown.value = false
  finishedResults.value = []
  hasArchived.value = false
  restart()
  stopMusic()
  play('click')
}

async function onBackToSubject() {
  const classId = selectedClass.value?.id ?? null
  if (classId) {
    try {
      await resetClassScores(classId)
      await fetchSubjectScores()
    } catch (err) {
      quizError.value = err.message || 'Poin game ini belum berhasil direset. Silakan coba lagi.'
      return
    }
  }
  pendingAnswer.value = ''
  stopTimer()
  backToSubject()
  stopMusic()
  play('click')
}

const { confirmState, askConfirm, runConfirm, cancelConfirm } = useConfirm()
const infoModal = reactive({ open: false, title: '', message: '' })

function showInfo(title, message) {
  infoModal.title = title
  infoModal.message = message
  infoModal.open = true
}

function closeInfo() {
  infoModal.open = false
}

function requestBackToSubject() {
  askConfirm(
    {
      title: 'Tinggalkan Kuis?',
      message:
        'Kuis yang sedang berjalan belum selesai: poin yang sudah diperoleh akan direset ' +
        'dan tidak akan tersimpan di Riwayat. Yakin ingin kembali ke pilihan materi?',
      confirmLabel: 'Ya, Kembali',
      cancelLabel: 'Lanjut Main',
      variant: 'danger',
    },
    onBackToSubject,
  )
}

function onQuizKeydown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
  if (confirmState.open) return

  const tag = event.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) {
    return
  }

  const key = event.key

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
    pickByNumber(playableSubjects.value, onSelectSubject)
    return
  }

  if (stage.value !== 'quiz' || showCountdown.value) return

  if (!selectedStudent.value) {
    pickByNumber(classStudents.value, onSelectStudent)
    return
  }

  if (showFeedback.value) {
    if (key === 'Enter' || key === ' ' || key === 'ArrowRight') {
      event.preventDefault()
      onNext()
    }
    return
  }

  if (key === 'Enter' && isMultipleChoice.value && pendingAnswer.value) {
    event.preventDefault()
    onSubmitOption()
  }
}

function onBackToClass() {
  pendingAnswer.value = ''
  restart()
  stopMusic()
  play('click')
}

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
    window.scrollTo({ top: 0, behavior: 'auto' })
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
  <div class="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
    <!-- ============================== HEADER ============================== -->
    <header
      v-if="stage === 'quiz'"
      class="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm"
    >
      <div class="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          title="Kembali untuk ganti materi"
          @click="requestBackToSubject"
        >
          <ArrowLeft :size="18" aria-hidden="true" />
          <span>Kembali</span>
        </button>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-3">
            <p class="whitespace-nowrap text-sm font-bold text-slate-700">
              Soal {{ currentQuestionNumber }}
              <span class="font-normal text-slate-400">/</span> {{ totalQuestions }}
            </p>
            <div
              class="hidden h-2.5 w-32 overflow-hidden rounded-full bg-slate-100 sm:block lg:w-44"
              role="progressbar"
              :aria-valuenow="progressBarPercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="h-full rounded-full bg-brand-600 transition-all duration-500"
                :style="{ width: progressBarPercent + '%' }"
              />
            </div>
          </div>

          <span
            v-if="selectedClass"
            class="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 shadow-xs"
          >
            {{ selectedClass.name }}
          </span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1700px] px-4 py-6 lg:px-6">
      <!-- =============================== ERROR =============================== -->
      <div
        v-if="quizError || studentsError || questionsError || subjectsError"
        class="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-red-800 shadow-xs"
      >
        <span class="text-xl" aria-hidden="true">⚠️</span>
        <div>
          <h3 class="text-sm font-bold">Terjadi Kesalahan</h3>
          <p class="mt-0.5 text-sm font-medium text-red-700">
            {{ quizError || studentsError || questionsError || subjectsError }}
          </p>
        </div>
      </div>

      <!-- =========================== PILIH KELAS =========================== -->
      <div
        v-if="classesNeedMigration"
        class="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-800 shadow-xs"
      >
        <p class="text-sm font-bold">⚠️ Tabel kelas belum tersedia</p>
        <p class="mt-1 text-xs font-medium text-amber-700">
          Jalankan file <code class="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-amber-900">supabase/migration_classes.sql</code> di SQL Editor
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
      <div
        v-else-if="stage === 'quiz'"
        class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]"
      >
        <!-- ====================== KIRI: SOAL & PILIHAN ====================== -->
        <section class="min-w-0 space-y-5">
          <div v-if="isLoadingQuiz" class="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Loader2 class="mx-auto h-8 w-8 animate-spin text-brand-600" />
            <p class="mt-3 text-sm font-semibold text-slate-500">Memuat pertanyaan...</p>
          </div>

          <QuestionCard
            v-else-if="currentQuestion"
            :question="currentQuestion"
            :question-number="currentQuestionNumber"
            :total-questions="totalQuestions"
            :time-left="isTimerRunning ? timeLeft : null"
            :time-limit="effectiveTimeLimit > 0 ? effectiveTimeLimit : null"
          >
            <MultipleChoice
              v-if="isMultipleChoice"
              :key="currentQuestion.id"
              :options="displayOptions"
              :selected-answer="pendingAnswer"
              :correct-answer="currentQuestion.correct_answer"
              :revealed="isRevealed"
              :disabled="isSubmitting"
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

            <div v-if="isMultipleChoice && selectedStudent && !isRevealed" class="mt-6 flex justify-center">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                :disabled="!pendingAnswer || isSubmitting"
                @click="onSubmitOption"
              >
                <Loader2 v-if="isSubmitting" class="h-5 w-5 animate-spin" />
                <span>{{ isSubmitting ? 'Memeriksa...' : 'Kirim Jawaban' }}</span>
              </button>
            </div>
          </QuestionCard>

          <!-- SIAPA YANG INGIN MENJAWAB -->
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">
                Siswa Menjawab yang ingin menjawab
              </h2>
            </div>

            <div
              v-if="currentStudent"
              class="mt-3 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-brand-900 shadow-xs"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
                  <UserCheck :size="20" />
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-brand-600">Sedang Menjawab</p>
                  <p class="truncate text-base font-bold text-slate-900">{{ currentStudent.name }}</p>
                </div>
              </div>
            </div>

            <div v-if="isLoadingStudents" class="mt-6 py-4 text-center">
              <Loader2 class="mx-auto h-6 w-6 animate-spin text-slate-400" />
              <p class="mt-2 text-xs font-medium text-slate-400">Memuat daftar siswa...</p>
            </div>

            <div v-else-if="classStudents.length === 0" class="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <HelpCircle class="mx-auto h-8 w-8 text-slate-300" />
              <p class="mt-2 text-sm font-bold text-slate-700">Belum Ada Siswa di Kelas Ini</p>
              <p class="mt-0.5 text-xs text-slate-400">Tambahkan siswa terlebih dahulu melalui Dashboard Guru.</p>
            </div>

            <div
              v-else-if="!selectedStudent"
              class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              <button
                v-for="student in classStudents"
                :key="student.id"
                type="button"
                class="group relative truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 active:scale-95"
                @click="onSelectStudent(student)"
              >
                <span class="truncate block">{{ student.name }}</span>
              </button>
            </div>
          </div>
        </section>

        <!-- ===================== KANAN: PAPAN SKOR ===================== -->
        <aside class="min-w-0">
          <div class="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div class="flex items-center gap-2">
                <Trophy :size="18" class="text-amber-500" />
                <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Papan Skor</h2>
              </div>
              <ScoreDisplay v-if="currentStudent" :streak="streak" compact />
            </div>

            <Leaderboard
              :students="sideLeaderboard"
              :limit="6"
              compact
              :highlight-id="currentStudent?.id ?? ''"
            />
          </div>
        </aside>
      </div>

      <!-- ============================= SELESAI ============================= -->
      <div v-else-if="stage === 'finished'" class="mx-auto max-w-2xl py-6">
        <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ConfettiBurst :count="40" />
          
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-8 ring-amber-50/50">
            <Sparkles :size="36" />
          </div>

          <h2 class="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">Kuis Selesai!</h2>
          <p class="mt-1 text-sm font-medium text-slate-500">Terima kasih telah berpartisipasi. Berikut adalah peringkat akhir kuis.</p>

          <div class="mt-6 rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-left">
            <Leaderboard :students="finishedResults" :limit="10" />
          </div>

          <div v-if="isFinishing" class="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            <Loader2 class="h-4 w-4 animate-spin" />
            <span>Menyimpan hasil kuis ke riwayat...</span>
          </div>

          <div class="mt-6 flex justify-center">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-95 disabled:opacity-50"
              :disabled="isFinishing"
              @click="onFinishBack"
            >
              <ArrowLeft :size="18" aria-hidden="true" />
              <span>Selesai & Kembali</span>
            </button>
          </div>
        </div>
      </div>
    </main>

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

    <InfoModal
      :open="infoModal.open"
      :title="infoModal.title"
      :message="infoModal.message"
      @close="closeInfo"
    />
  </div>
</template>