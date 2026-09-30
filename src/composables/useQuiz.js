import { computed, ref } from 'vue'
import { useQuestions, shuffleArray } from './useQuestions'
import { useSubjectScores } from './useSubjectScores'
import { useSettings } from './useSettings'
import { useSound } from './useSound'

/** Compare answers in a predictable way: ignore case, trim, collapse spaces. */
export function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * The whole quiz flow lives here:
 * pilih siswa -> pilih materi -> hitung mundur -> jawab soal -> feedback.
 */

// True while a question is on screen (drives the header music button).
export const isAnswering = ref(false)
export function useQuiz() {
  const { fetchQuestionsBySubject } = useQuestions()
  const { addScore } = useSubjectScores()
  const { settings } = useSettings()
  const { play } = useSound()

  // stage: 'class' | 'subject' | 'quiz' | 'finished'
  // One teacher, many classes: pick the class first, then the material.
  // The question is shown first so the whole class can think together,
  // then one student is picked to answer it:
  // class -> subject -> quiz (locked, pick a student) -> countdown -> quiz (answering).
  const stage = ref('class')

  const selectedClass = ref(null)
  const selectedStudent = ref(null)
  const selectedSubject = ref('')
  const questions = ref([])
  const currentQuestionIndex = ref(0)

  const selectedAnswer = ref(null)
  // answerStatus: 'idle' | 'checking' | 'correct' | 'wrong' | 'timeout'
  const answerStatus = ref('idle')
  const showFeedback = ref(false)
  const awardedPoints = ref(0)
  const streak = ref(0)

  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const error = ref('')

  // ---- answer timer -------------------------------------------------------
  // Runs while a picked student is answering. 0 seconds = no time limit.
  const timeLeft = ref(0)
  const timerTotal = ref(0)
  const isTimerRunning = ref(false)
  let timerInterval = null
  let timerEndAt = 0
  let lastTickSecond = -1

  const timerPercent = computed(() =>
    timerTotal.value > 0 ? Math.round((timeLeft.value / timerTotal.value) * 100) : 0,
  )

  function stopTimer() {
    if (timerInterval) {
      window.clearInterval(timerInterval)
      timerInterval = null
    }
    isTimerRunning.value = false
  }

  function startTimer() {
    stopTimer()
    const total = Number(settings.value.answerTimeLimit) || 0
    if (total <= 0) return
    timerTotal.value = total
    timeLeft.value = total
    lastTickSecond = total + 1
    timerEndAt = Date.now() + total * 1000
    isTimerRunning.value = true
    timerInterval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000))
      if (remaining <= 5 && remaining > 0 && remaining < lastTickSecond) {
        lastTickSecond = remaining
        play('countTick')
      }
      timeLeft.value = remaining
      if (remaining <= 0) expireTimer()
    }, 250)
  }

  /** Time ran out: no points, streak reset, offer Ganti Siswa / Lanjut. */
  function expireTimer() {
    stopTimer()
    if (answerStatus.value !== 'idle') return
    if (!currentQuestion.value || !selectedStudent.value) return
    streak.value = 0
    awardedPoints.value = 0
    answerStatus.value = 'timeout'
    showFeedback.value = true
  }

  const currentQuestion = computed(() => questions.value[currentQuestionIndex.value] ?? null)
  const totalQuestions = computed(() => questions.value.length)
  const currentQuestionNumber = computed(() =>
    totalQuestions.value === 0 ? 0 : currentQuestionIndex.value + 1,
  )
  const progressPercent = computed(() => {
    if (totalQuestions.value === 0) return 0
    return Math.round((currentQuestionIndex.value / totalQuestions.value) * 100)
  })
  const isLastQuestion = computed(
    () => totalQuestions.value > 0 && currentQuestionIndex.value === totalQuestions.value - 1,
  )

  /** Randomize answer options for multiple choice, without touching the label. */
  const displayOptions = computed(() => {
    const question = currentQuestion.value
    if (!question || question.type !== 'multiple_choice' || !Array.isArray(question.options)) return []
    return settings.value.shuffleOptions ? shuffleArray(question.options) : question.options
  })

  function selectStudent(student) {
    selectedStudent.value = student
  }

  function selectClass(schoolClass) {
    selectedClass.value = schoolClass
    stage.value = 'subject'
  }

  /** Back to subject selection, keeping the class (wrong subject picked). */
  function backToSubject() {
    stopTimer()
    selectedSubject.value = ''
    selectedStudent.value = null
    questions.value = []
    currentQuestionIndex.value = 0
    resetQuestionState()
    error.value = ''
    stage.value = 'subject'
  }

  async function selectSubject(subject) {
    selectedSubject.value = subject
    await startQuiz()
  }

  async function startQuiz() {
    isLoading.value = true
    error.value = ''
    try {
      questions.value = await fetchQuestionsBySubject(selectedSubject.value, {
        limit: Number(settings.value.questionCountPerQuiz) || 0,
        shuffle: Boolean(settings.value.shuffleQuestions),
      })

      if (questions.value.length === 0) {
        error.value = 'Belum ada soal untuk materi ini. Pilih materi lain ya.'
        return
      }

      currentQuestionIndex.value = 0
      resetQuestionState()
      selectedStudent.value = null
      stage.value = 'quiz'
    } catch (err) {
      error.value = err.message || 'Soal belum berhasil dimuat. Silakan coba lagi.'
    } finally {
      isLoading.value = false
    }
  }

  function resetQuestionState() {
    selectedAnswer.value = null
    answerStatus.value = 'idle'
    showFeedback.value = false
    awardedPoints.value = 0
    isSubmitting.value = false
  }

  /**
   * Check one answer. Guarded by `isSubmitting` and `answerStatus` so a double
   * click can never award points twice.
   */
  async function submitAnswer(rawValue) {
    if (isSubmitting.value) return false
    if (answerStatus.value !== 'idle') return false

    const question = currentQuestion.value
    const student = selectedStudent.value
    if (!question || !student) return false

    const value = String(rawValue ?? '').trim()
    if (!value) return false

    stopTimer()
    selectedAnswer.value = value
    isSubmitting.value = true
    answerStatus.value = 'checking'
    error.value = ''

    const isCorrect = normalizeAnswer(value) === normalizeAnswer(question.correct_answer)
    const points = Number(settings.value.pointsPerCorrect) || 10

    if (isCorrect) {
      try {
        // Points go to the question's own subject (matters for "Semua Materi").
        await addScore(student.id, points, question.subject)
        awardedPoints.value = points
        streak.value += 1
        answerStatus.value = 'correct'
      } catch (err) {
        // Never pretend the score was saved. Let the student try again.
        error.value = err.message || 'Poin belum berhasil disimpan. Silakan coba lagi.'
        answerStatus.value = 'idle'
        selectedAnswer.value = null
        isSubmitting.value = false
        startTimer()
        return false
      }
    } else {
      awardedPoints.value = 0
      streak.value = 0
      answerStatus.value = 'wrong'
    }

    showFeedback.value = true
    isSubmitting.value = false
    return true
  }

  /** Move on. With no points awarded when the answer was wrong. */
  function nextQuestion() {
    stopTimer()
    resetQuestionState()
    error.value = ''

    if (currentQuestionIndex.value < questions.value.length - 1) {
      currentQuestionIndex.value += 1
      // Lock the next question until a student is picked to answer it.
      selectedStudent.value = null
    } else {
      stage.value = 'finished'
    }
  }
  function tryAgain() {
    resetQuestionState()
    error.value = ''
  }

  function restart() {
    stopTimer()
    selectedClass.value = null
    selectedStudent.value = null
    selectedSubject.value = ''
    questions.value = []
    currentQuestionIndex.value = 0
    streak.value = 0
    resetQuestionState()
    error.value = ''
    stage.value = 'class'
  }

  return {
    // state
    stage,
    selectedClass,
    selectedStudent,
    selectedSubject,
    questions,
    currentQuestionIndex,
    selectedAnswer,
    answerStatus,
    showFeedback,
    awardedPoints,
    streak,
    isLoading,
    isSubmitting,
    error,
    timeLeft,
    timerTotal,
    timerPercent,
    isTimerRunning,
    // getters
    currentQuestion,
    currentQuestionNumber,
    totalQuestions,
    progressPercent,
    isLastQuestion,
    displayOptions,
    // actions
    selectClass,
    backToSubject,
    selectStudent,
    selectSubject,
    startQuiz,
    submitAnswer,
    tryAgain,
    nextQuestion,
    restart,
    startTimer,
    stopTimer,
  }
}
