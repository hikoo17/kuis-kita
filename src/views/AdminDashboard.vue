<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  ImagePlus,
  Music,
  Pencil,
  Plus,
  RotateCcw,
  School,
  Search,
  Settings,
  Trash2,
  Users,
  Volume2,
  X,
  BookOpen, HelpCircle
} from '@lucide/vue'

import { useStudents } from '@/composables/useStudents'
import { useQuestions, QUESTION_IMAGE_MAX_BYTES } from '@/composables/useQuestions'
import { useSubjects } from '@/composables/useSubjects'
import { useSettings, DEFAULT_SETTINGS } from '@/composables/useSettings'
import { useSound } from '@/composables/useSound'
import { useMusic } from '@/composables/useMusic'
import { useClasses } from '@/composables/useClasses'
import { useModalFocus } from '@/composables/useModalFocus'
import { useSubjectScores } from '@/composables/useSubjectScores'
import { useQuizSessions } from '@/composables/useQuizSessions'
import ConfirmModal from '@/components/ConfirmModal.vue'
import MathText from '@/components/MathText.vue'
import InfoButton from '@/components/InfoButton.vue'
import InfoModal from '@/components/InfoModal.vue'

// Wizard impor berat (JSZip + pembaca docx) dimuat hanya saat dipakai.
const ImportQuestionsModal = defineAsyncComponent(
  () => import('@/components/ImportQuestionsModal.vue'),
)
// Impor siswa juga memakai JSZip (pembaca .xlsx) — muat saat dibuka saja.
const ImportStudentsModal = defineAsyncComponent(
  () => import('@/components/ImportStudentsModal.vue'),
)
import { downloadCsv, datedFilename } from '@/lib/exportCsv'

const { play } = useSound()
const { isPlaying: isMusicPlaying, toggle: toggleMusicPreview } = useMusic()

const {
  students,
  isLoading: isLoadingStudents,
  error: studentsError,
  fetchStudents,
  addStudent,
  deleteStudent,
  renameStudent,
  updateStudentClass,
  resetStudentScore,
  resetAllScores,
  resetClassScores,
} = useStudents()

const {
  questions,
  isLoading: isLoadingQuestions,
  error: questionsError,
  fetchQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  deleteQuestionsBySubject,
  uploadQuestionImage,
  deleteQuestionImage,
  imageColumnAvailable,
  checkImageSupport,
  timeColumnAvailable,
  checkTimeSupport,
} = useQuestions()

const {
  subjectList,
  isLoading: isLoadingSubjects,
  error: subjectsError,
  needsMigration,
  fetchSubjects,
  addSubject,
  renameSubject,
  deleteSubject,
} = useSubjects()

const { settings, updateSettings, resetSettings } = useSettings()
const {
  classList,
  isLoading: isLoadingClasses,
  error: classesError,
  needsMigration: classesNeedMigration,
  fetchClasses,
  addClass,
  renameClass,
  deleteClass,
} = useClasses()
const { fetchSubjectScores } = useSubjectScores()

const activeTab = ref('classes')
const tabs = [
  { id: 'classes', label: 'Kelola Kelas', icon: School },
  { id: 'students', label: 'Kelola Siswa', icon: Users },
  { id: 'questions', label: 'Kelola Soal', icon: FileText },
  { id: 'history', label: 'Riwayat', icon: Archive },
  { id: 'settings', label: 'Pengaturan Kuis', icon: Settings },
]

// ---------------------------------------------------------------- toast ----
const toast = reactive({ show: false, type: 'success', message: '' })
let toastTimer = null

function showToast(message, type = 'success') {
  toast.message = message
  toast.type = type
  toast.show = true
  play(type === 'error' ? 'error' : 'success')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.show = false
  }, 3200)
}

// -------------------------------------------------------- info modal ------
const infoModal = reactive({ open: false, title: '', message: '' })

function showInfo(title, message) {
  infoModal.title = title
  infoModal.message = message
  infoModal.open = true
}

function closeInfo() {
  infoModal.open = false
}

// ------------------------------------------------------------ confirm ------
const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Ya, Lanjutkan',
  variant: 'danger',
  loading: false,
})
let confirmAction = null

function askConfirm(options, action) {
  Object.assign(confirmState, options, { open: true, loading: false })
  confirmAction = action
}

async function runConfirm() {
  if (!confirmAction) return
  confirmState.loading = true
  try {
    await confirmAction()
  } catch (err) {
    showToast(err.message || 'Terjadi kesalahan. Silakan coba lagi.', 'error')
  } finally {
    confirmState.loading = false
    confirmState.open = false
    confirmAction = null
  }
}

function cancelConfirm() {
  confirmState.open = false
  confirmAction = null
}

// ------------------------------------------------------------ classes ------
const newClassName = ref('')
const isAddingClass = ref(false)
const editingClassId = ref('')
const editClassName = ref('')
const isSavingClass = ref(false)
const classSearch = ref('')

const filteredClasses = computed(() => {
  const keyword = classSearch.value.trim().toLowerCase()
  if (!keyword) return classList.value
  return classList.value.filter((item) => item.name.toLowerCase().includes(keyword))
})

async function handleAddClass() {
  const name = newClassName.value.trim()
  if (!name) {
    showToast('Nama kelas wajib diisi.', 'error')
    return
  }
  isAddingClass.value = true
  try {
    await addClass(name)
    newClassName.value = ''
    showToast(`Kelas "${name}" berhasil ditambahkan.`)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    isAddingClass.value = false
  }
}

function startRenameClass(item, event) {
  event?.stopPropagation()
  editingClassId.value = item.id
  editClassName.value = item.name
}

function cancelRenameClass() {
  editingClassId.value = ''
  editClassName.value = ''
}

async function handleRenameClass() {
  const trimmed = editClassName.value.trim()
  if (!trimmed) {
    showToast('Nama kelas wajib diisi.', 'error')
    return
  }
  isSavingClass.value = true
  try {
    await renameClass(editingClassId.value, trimmed)
    showToast('Nama kelas berhasil diubah.')
    cancelRenameClass()
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    isSavingClass.value = false
  }
}

function classStudentCount(classId) {
  return students.value.filter((student) => student.class_id === classId).length
}

function handleDeleteClass(item, event) {
  event?.stopPropagation()
  const count = classStudentCount(item.id)
  const extra =
    count > 0
      ? ` Kelas ini memiliki ${count} siswa — semuanya beserta poinnya ikut terhapus.`
      : ' Kelas ini belum memiliki siswa.'
  askConfirm(
    {
      title: 'Hapus Kelas?',
      message: `Kelas "${item.name}" akan dihapus.${extra}\nTindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      variant: 'danger',
    },
    async () => {
      await deleteClass(item.id)
      // Cascade already removed the students; refresh scores to match.
      await Promise.all([fetchStudents(), fetchSubjectScores()])
      showToast(`Kelas "${item.name}" berhasil dihapus.`)
    },
  )
}

// ------------------------------------------------------------ students -----
const newStudentName = ref('')
const newStudentClassId = ref('')
const isAddingStudent = ref(false)
const editingStudentId = ref('')
const editStudentName = ref('')
const isSavingStudent = ref(false)
// 'all' = every class, otherwise filter the list by class.
const studentClassFilter = ref('all')
const studentSearch = ref('')
const showImportStudents = ref(false)

const filteredStudents = computed(() => {
  const keyword = studentSearch.value.trim().toLowerCase()
  return students.value.filter((student) => {
    const matchClass = studentClassFilter.value === 'all' || student.class_id === studentClassFilter.value
    if (!matchClass) return false
    if (!keyword) return true
    return student.name.toLowerCase().includes(keyword)
  })
})

// If the filtered class disappears (deleted), fall back to all classes.
watch(classList, (list) => {
  if (studentClassFilter.value !== 'all' && !list.some((item) => item.id === studentClassFilter.value)) {
    studentClassFilter.value = 'all'
  }
})

async function handleAddStudent() {
  const name = newStudentName.value.trim()
  if (!name) {
    showToast('Nama siswa wajib diisi.', 'error')
    return
  }
  if (!newStudentClassId.value) {
    showToast('Pilih kelasnya dulu.', 'error')
    return
  }
  isAddingStudent.value = true
  try {
    await addStudent(name, newStudentClassId.value)
    newStudentName.value = ''
    showToast(`Siswa "${name}" berhasil ditambahkan.`)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    isAddingStudent.value = false
  }
}

function onStudentsImported({ count, failures }) {
  if (failures.length === 0) {
    showToast(`${count} siswa berhasil diimport.`)
    return
  }

  const lines = failures.slice(0, 8).map((item) => `• ${item.name}: ${item.reason}`)
  if (failures.length > 8) lines.push(`… dan ${failures.length - 8} lainnya.`)
  const header =
    count > 0
      ? `${count} siswa berhasil diimport.`
      : 'Tidak ada siswa yang berhasil diimport.'
  showInfo(
    'Hasil Import Siswa',
    `${header}\n\n${failures.length} siswa gagal dimasukkan:\n${lines.join('\n')}`,
  )
}

async function handleMoveStudent(student, event) {
  const classId = event.target.value
  if (!classId || classId === student.class_id) return
  try {
    await updateStudentClass(student.id, classId)
    showToast(`${student.name} dipindahkan ke kelas.`)
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function startRenameStudent(student) {
  editingStudentId.value = student.id
  editStudentName.value = student.name
}

function cancelRenameStudent() {
  editingStudentId.value = ''
  editStudentName.value = ''
}

async function handleRenameStudent() {
  const trimmed = editStudentName.value.trim()
  if (!trimmed) {
    showToast('Nama siswa wajib diisi.', 'error')
    return
  }
  isSavingStudent.value = true
  try {
    await renameStudent(editingStudentId.value, trimmed)
    showToast('Nama siswa berhasil diubah.')
    cancelRenameStudent()
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    isSavingStudent.value = false
  }
}

function handleDeleteStudent(student) {
  askConfirm(
    {
      title: 'Hapus Siswa?',
      message: `Siswa "${student.name}" akan dihapus beserta poinnya.\nTindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      variant: 'danger',
    },
    async () => {
      await deleteStudent(student.id)
      showToast(`Siswa "${student.name}" berhasil dihapus.`)
    },
  )
}

function handleResetStudent(student) {
  askConfirm(
    {
      title: 'Reset Poin?',
      message: `Poin ${student.name} akan kembali menjadi 0.`,
      confirmLabel: 'Reset Poin',
      variant: 'primary',
    },
    async () => {
      await resetStudentScore(student.id)
      showToast(`Poin ${student.name} berhasil direset.`)
    },
  )
}

function handleResetAllScores() {
  const classId = studentClassFilter.value
  const isAll = classId === 'all'
  const className = isAll ? '' : (classList.value.find((item) => item.id === classId)?.name ?? '')
  askConfirm(
    {
      title: isAll ? 'Reset Semua Poin?' : `Reset Poin Kelas ${className}?`,
      message: isAll
        ? 'Semua poin siswa di seluruh kelas akan kembali menjadi 0.'
        : `Semua poin siswa di kelas ${className} akan kembali menjadi 0.`,
      confirmLabel: 'Reset',
      variant: 'danger',
    },
    async () => {
      if (isAll) {
        await resetAllScores()
        showToast('Semua poin siswa berhasil direset.')
      } else {
        await resetClassScores(classId)
        showToast(`Poin kelas ${className} berhasil direset.`)
      }
    },
  )
}

// ----------------------------------------------------------- questions -----
// Two levels: subject cards first (from the subjects table), then the
// questions inside the opened subject.
const activeSubject = ref('') // '' = show the subject cards
const showQuestionForm = ref(false) // form is collapsed until "Tambah Soal"
const questionDialogRef = ref(null)
const filterType = ref('all')

useModalFocus(
  () => showQuestionForm.value,
  questionDialogRef,
  () => resetForm(),
)

/** One card per subject, with a small summary of its questions. */
const subjectCards = computed(() =>
  subjectList.value.map((subject) => {
    const related = questions.value.filter((question) => question.subject === subject.name)
    return {
      id: subject.id,
      name: subject.name,
      total: related.length,
      multipleChoice: related.filter((question) => question.type === 'multiple_choice').length,
      shortAnswer: related.filter((question) => question.type === 'short_answer').length,
    }
  }),
)

/** Questions of the subject currently opened, optionally filtered by type. */
const subjectQuestions = computed(() =>
  questions.value.filter((question) => {
    if (question.subject !== activeSubject.value) return false
    return filterType.value === 'all' || question.type === filterType.value
  }),
)

/** Total soal materi ini (tanpa filter tipe) — untuk tombol hapus semua. */
const activeSubjectTotal = computed(
  () => questions.value.filter((question) => question.subject === activeSubject.value).length,
)

// ------------------------------------------------------------ subjects -----
// The material form is fully separate: add the subject first, then its questions.
const newSubjectName = ref('')
const isAddingSubject = ref(false)
const editingSubjectId = ref('')
const editSubjectName = ref('')
const isSavingSubject = ref(false)

async function handleAddSubject() {
  const name = newSubjectName.value.trim()
  if (!name) {
    showToast('Nama materi wajib diisi.', 'error')
    return
  }
  isAddingSubject.value = true
  try {
    await addSubject(name)
    newSubjectName.value = ''
    showToast(`Materi "${name}" berhasil ditambahkan. Klik kartunya untuk mengisi soal.`)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    isAddingSubject.value = false
  }
}

function startRenameSubject(card, event) {
  event?.stopPropagation()
  editingSubjectId.value = card.id
  editSubjectName.value = card.name
}

function cancelRenameSubject() {
  editingSubjectId.value = ''
  editSubjectName.value = ''
}

async function handleRenameSubject() {
  const trimmed = editSubjectName.value.trim()
  if (!trimmed) {
    showToast('Nama materi wajib diisi.', 'error')
    return
  }
  isSavingSubject.value = true
  try {
    await renameSubject(editingSubjectId.value, trimmed)
    showToast('Nama materi berhasil diubah.')
    cancelRenameSubject()
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    isSavingSubject.value = false
  }
}

function handleDeleteSubject(card, event) {
  event?.stopPropagation()
  const extra =
    card.total > 0
      ? ` Materi ini memiliki ${card.total} soal — semuanya ikut terhapus.`
      : ' Materi ini belum memiliki soal.'
  askConfirm(
    {
      title: 'Hapus Materi?',
      message: `Materi "${card.name}" akan dihapus.${extra}\nTindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      variant: 'danger',
    },
    async () => {
      await deleteSubject(card.id)
      if (activeSubject.value === card.name) backToSubjects()
      showToast(`Materi "${card.name}" berhasil dihapus.`)
    },
  )
}

const emptyOption = (label) => ({ label, text: '', image: null, imageFile: null, previewUrl: '' })

const emptyForm = () => ({
  subject: '',
  type: 'multiple_choice',
  question_text: '',
  options: [emptyOption('A'), emptyOption('B'), emptyOption('C'), emptyOption('D')],
  correct_answer: '',
  image_url: '',
})

const isSavingQuestion = ref(false)

// --- Form soal multi-kartu dalam satu modal ---
// Tiap kartu punya state sendiri supaya bisa tambah banyak soal sekaligus.
let questionKey = 0

function globalDefaultTimeLimit() {
  const value = Math.floor(Number(settings.value.answerTimeLimit))
  return Number.isFinite(value) ? Math.max(0, value) : null
}

function newQuestionState(subject) {
  return {
    key: ++questionKey,
    editingId: '',
    form: {
      subject,
      type: 'multiple_choice',
      question_text: '',
      options: [emptyOption('A'), emptyOption('B'), emptyOption('C'), emptyOption('D')],
      correct_answer: '',
      image_url: '',
      time_limit: globalDefaultTimeLimit(),
    },
    imageFile: null,
    previewUrl: '',
    toDelete: [],
    dragging: false,
  }
}

const questionStates = ref([])
const isEditMode = computed(
  () => questionStates.value.length === 1 && !!questionStates.value[0]?.editingId,
)

// Elemen <input type=file> per kartu (gambar soal & gambar pilihan).
const questionImageEls = new Map()
const optionImageEls = new Map()
const pendingOptionImage = ref({ key: 0, label: '' })

function setQuestionImageRef(key, node) {
  if (node) questionImageEls.set(key, node)
  else questionImageEls.delete(key)
}

function setOptionImageRef(key, node) {
  if (node) optionImageEls.set(key, node)
  else optionImageEls.delete(key)
}

function questionPreview(state) {
  return state.previewUrl || state.form.image_url || ''
}

// --- Impor soal dari Word ---
const showImport = ref(false)

/** Tampilkan pratinjau hanya untuk teks yang memuat rumus/matriks. */
function hasMath(value) {
  const text = String(value ?? '')
  return text.includes('$') || text.includes('[[')
}

function onImported(count) {
  showImport.value = false
  showToast(`${count} soal berhasil diimport.`)
}

/** Batas pilihan jawaban (mendukung lebih dari 4 pilihan). */
const MAX_OPTIONS = 10

/** Label berikutnya yang belum terpakai: A, B, C, ... */
function nextOptionLabel(form) {
  for (let code = 65; code <= 90; code += 1) {
    const label = String.fromCharCode(code)
    if (!form.options.some((option) => option.label === label)) return label
  }
  return ''
}

/** Tambah satu pilihan jawaban baru (E, F, ...). */
function addOption(state) {
  const form = state.form
  if (form.options.length >= MAX_OPTIONS) {
    showToast(`Maksimal ${MAX_OPTIONS} pilihan jawaban.`, 'error')
    return
  }
  const label = nextOptionLabel(form)
  if (!label) return
  form.options.push(emptyOption(label))
}

/** Hapus satu pilihan jawaban (sisakan minimal 2). */
function removeOption(state, label) {
  const form = state.form
  if (form.options.length <= 2) {
    showToast('Minimal 2 pilihan jawaban.', 'error')
    return
  }
  const removed = form.options.find((option) => option.label === label)
  if (removed) {
    if (removed.image) state.toDelete.push(removed.image)
    if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
  }
  form.options = form.options.filter((option) => option.label !== label)
  if (form.correct_answer === label) form.correct_answer = ''
}

/** Bebaskan object URL pratinjau gambar pilihan. */
function revokeOptionPreviews(list) {
  ;(list ?? []).forEach((option) => {
    if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
  })
}

/** Bersihkan status gambar satu kartu tanpa menyentuh berkas server. */
function clearStateImage(state) {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl)
  state.imageFile = null
  state.previewUrl = ''
  state.dragging = false
  const input = questionImageEls.get(state.key)
  if (input) input.value = ''
}

/** Validasi + terapkan satu berkas gambar ke kartu. Dipakai oleh input & drag-drop. */
function acceptQuestionImage(state, file) {
  if (!file) return false

  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar (JPG, PNG, atau WebP).', 'error')
    return false
  }
  if (file.size > QUESTION_IMAGE_MAX_BYTES) {
    showToast('Ukuran gambar maksimal 5 MB.', 'error')
    return false
  }

  // Gambar lama yang tersimpan akan diganti → hapus setelah simpan sukses.
  if (state.form.image_url) state.toDelete.push(state.form.image_url)
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl)

  state.imageFile = file
  state.previewUrl = URL.createObjectURL(file)
  state.form.image_url = ''
  return true
}

function onQuestionImageSelect(state, event) {
  const accepted = acceptQuestionImage(state, event.target.files?.[0])
  if (!accepted) event.target.value = ''
}

function onQuestionImageDrop(state, event) {
  state.dragging = false
  if (imageColumnAvailable.value === false) return
  acceptQuestionImage(state, event.dataTransfer?.files?.[0])
}

function onQuestionImageDragOver(state) {
  if (imageColumnAvailable.value !== false) state.dragging = true
}

function onQuestionImageDragLeave(state, event) {
  // Hanya lepas sorotan kalau kursor benar-benar keluar dari area drop.
  if (!event.currentTarget.contains(event.relatedTarget)) state.dragging = false
}

function removeQuestionImage(state) {
  if (state.form.image_url) state.toDelete.push(state.form.image_url)
  clearStateImage(state)
  state.form.image_url = ''
}

// Gambar tiap pilihan jawaban: satu input berkas per kartu,
// berkas diunggah saat soal disimpan.
function acceptOptionImage(state, option, file) {
  if (!file) return false

  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar (JPG, PNG, atau WebP).', 'error')
    return false
  }
  if (file.size > QUESTION_IMAGE_MAX_BYTES) {
    showToast('Ukuran gambar maksimal 5 MB.', 'error')
    return false
  }

  if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
  option.imageFile = file
  option.previewUrl = URL.createObjectURL(file)
  return true
}

function optionPreview(option) {
  return option.previewUrl || option.image || ''
}

function pickOptionImage(state, label) {
  pendingOptionImage.value = { key: state.key, label }
  optionImageEls.get(state.key)?.click()
}

function onOptionImageSelect(state, event) {
  const target = pendingOptionImage.value
  const option =
    target.key === state.key
      ? state.form.options.find((item) => item.label === target.label)
      : null
  const accepted = option ? acceptOptionImage(state, option, event.target.files?.[0]) : false
  event.target.value = ''
  if (!accepted) pendingOptionImage.value = { key: 0, label: '' }
}

/** Hapus gambar satu pilihan (berkas server dihapus setelah simpan sukses). */
function removeOptionImage(state, option) {
  if (option.image) state.toDelete.push(option.image)
  if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
  option.image = null
  option.imageFile = null
  option.previewUrl = ''
}

function cleanupState(state) {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl)
  revokeOptionPreviews(state.form.options)
}

function resetForm() {
  questionStates.value.forEach(cleanupState)
  questionStates.value = []
  showQuestionForm.value = false
}

function openSubject(name) {
  activeSubject.value = name
  filterType.value = 'all'
  resetForm()
}

function backToSubjects() {
  activeSubject.value = ''
  resetForm()
}

function startAddQuestion() {
  resetForm()
  questionStates.value = [newQuestionState(activeSubject.value)]
  showQuestionForm.value = true
}

/** Tambah kartu soal baru di modal yang sama. */
function addQuestionCard() {
  questionStates.value.push(newQuestionState(activeSubject.value))
}

/** Hapus kartu soal dari modal (sisakan minimal 1). */
function removeQuestionCard(index) {
  if (questionStates.value.length <= 1) return
  const [removed] = questionStates.value.splice(index, 1)
  if (removed) cleanupState(removed)
}

function startEdit(question) {
  resetForm()
  const state = newQuestionState(question.subject)
  state.editingId = question.id
  state.form.type = question.type
  state.form.question_text = question.question_text
  state.form.correct_answer = question.correct_answer
  state.form.image_url = question.image_url ?? ''
  state.form.time_limit = question.time_limit ?? null

  const existing = Array.isArray(question.options) ? question.options : []
  const source = existing.length > 0 ? existing : emptyForm().options
  state.form.options = source.map((option) => ({
    label: String(option.label ?? '').trim().toUpperCase(),
    text: String(option.text ?? ''),
    image: String(option.image ?? '').trim() || null,
    imageFile: null,
    previewUrl: '',
  }))

  // Pastikan label kunci jawaban tetap ada (mis. soal lama dengan label di luar A-D).
  if (question.type === 'multiple_choice' && state.form.correct_answer && !state.form.options.some((o) => o.label === state.form.correct_answer)) {
    state.form.options.push({ ...emptyOption(state.form.correct_answer), text: '' })
  }

  questionStates.value = [state]
  showQuestionForm.value = true
}

function validateState(state, number) {
  const form = state.form
  if (!form.question_text.trim()) return `Soal ${number}: pertanyaan wajib diisi.`

  if (form.type === 'multiple_choice') {
    const filled = form.options.filter(
      (option) => option.text.trim() || option.image || option.imageFile,
    )
    if (filled.length < 2) return `Soal ${number}: isi minimal 2 pilihan jawaban (teks atau gambar).`
    if (!form.correct_answer.trim()) return `Soal ${number}: kunci jawaban wajib dipilih.`
    if (!filled.some((option) => option.label === form.correct_answer)) {
      return `Soal ${number}: kunci jawaban harus salah satu dari pilihan yang terisi.`
    }
  } else if (!form.correct_answer.trim()) {
    return `Soal ${number}: kunci jawaban wajib diisi.`
  }

  return ''
}

async function handleSaveAll() {
  if (!String(activeSubject.value ?? '').trim()) {
    showToast('Materi wajib diisi.', 'error')
    return
  }

  for (let index = 0; index < questionStates.value.length; index += 1) {
    const validationError = validateState(questionStates.value[index], index + 1)
    if (validationError) {
      showToast(validationError, 'error')
      return
    }
  }

  isSavingQuestion.value = true
  const uploadedThisRun = []
  const stale = []
  try {
    let added = 0
    let updated = 0

    for (const state of questionStates.value) {
      const form = state.form

      let imageUrl = form.image_url || null
      if (state.imageFile) {
        imageUrl = await uploadQuestionImage(state.imageFile)
        uploadedThisRun.push(imageUrl)
      }

      // Unggah gambar pilihan yang baru dipilih.
      if (form.type === 'multiple_choice') {
        for (const option of form.options) {
          if (option.imageFile) {
            const url = await uploadQuestionImage(option.imageFile)
            uploadedThisRun.push(url)
            if (option.image) state.toDelete.push(option.image)
            option.image = url
            option.imageFile = null
            if (option.previewUrl) URL.revokeObjectURL(option.previewUrl)
            option.previewUrl = ''
          }
        }
      }

      const payload = {
        subject: activeSubject.value,
        type: form.type,
        question_text: form.question_text,
        options: form.type === 'multiple_choice' ? form.options : null,
        correct_answer: form.correct_answer,
        image_url: imageUrl,
        time_limit: form.time_limit,
      }

      if (state.editingId) {
        await updateQuestion(state.editingId, payload)
        updated += 1
      } else {
        await addQuestion(payload)
        added += 1
      }
      stale.push(...state.toDelete)
    }

    // Baru setelah semua tersimpan, hapus gambar lama yang tak terpakai.
    stale.forEach((url) => deleteQuestionImage(url))

    resetForm()
    if (updated > 0 && added === 0) showToast('Perubahan soal berhasil disimpan.')
    else showToast(`${added + updated} soal berhasil disimpan.`)
  } catch (err) {
    // Jangan tinggalkan gambar yatim kalau penyimpanan soal gagal.
    uploadedThisRun.forEach((url) => deleteQuestionImage(url))
    showToast(err.message, 'error')
  } finally {
    isSavingQuestion.value = false
  }
}

function handleDeleteQuestion(question) {
  askConfirm(
    {
      title: 'Hapus Soal?',
      message: `Soal "${question.question_text.slice(0, 80)}${question.question_text.length > 80 ? '...' : ''}" akan dihapus.`,
      confirmLabel: 'Hapus',
      variant: 'danger',
    },
    async () => {
      await deleteQuestion(question.id)
      if (question.image_url) deleteQuestionImage(question.image_url)
      if (questionStates.value.some((state) => state.editingId === question.id)) resetForm()
      showToast('Soal berhasil dihapus.')
    },
  )
}

/** Hapus seluruh soal pada materi yang sedang dibuka (beserta gambarnya). */
function handleDeleteAllQuestions() {
  const count = activeSubjectTotal.value
  if (count === 0) return

  askConfirm(
    {
      title: 'Hapus Semua Soal?',
      message: `Semua ${count} soal pada materi "${activeSubject.value}" akan dihapus.\nTindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus Semua',
      variant: 'danger',
    },
    async () => {
      const imageUrls = questions.value
        .filter((question) => question.subject === activeSubject.value && question.image_url)
        .map((question) => question.image_url)

      const removed = await deleteQuestionsBySubject(activeSubject.value)
      imageUrls.forEach((url) => deleteQuestionImage(url))
      if (questionStates.value.length > 0) resetForm()
      showToast(`${removed} soal berhasil dihapus.`)
    },
  )
}

// ------------------------------------------------------------ settings -----
const settingsForm = reactive({ ...DEFAULT_SETTINGS })

function syncSettingsForm() {
  Object.assign(settingsForm, settings.value)
}

function handleSaveSettings() {
  updateSettings({
    pointsPerCorrect: Number(settingsForm.pointsPerCorrect) || 10,
    questionCountPerQuiz: Number(settingsForm.questionCountPerQuiz) || 0,
    shuffleQuestions: Boolean(settingsForm.shuffleQuestions),
    shuffleOptions: Boolean(settingsForm.shuffleOptions),
    soundEnabled: Boolean(settingsForm.soundEnabled),
    soundVolume: Math.min(100, Math.max(0, Number(settingsForm.soundVolume))),
    musicEnabled: Boolean(settingsForm.musicEnabled),
    musicVolume: Math.min(100, Math.max(0, Number(settingsForm.musicVolume))),
    answerTimeLimit: Math.min(300, Math.max(0, Number(settingsForm.answerTimeLimit))),
  })
  showToast('Pengaturan berhasil disimpan.')
}

function handleResetSettings() {
  resetSettings()
  syncSettingsForm()
  showToast('Pengaturan dikembalikan ke bawaan.')
}

function handleTestSound() {
  updateSettings({
    soundEnabled: true,
    soundVolume: Number(settingsForm.soundVolume),
  })
  settingsForm.soundEnabled = true
  play('correct')
}

// -------------------------------------------------------------- history -----
const {
  sessions,
  isLoading: isLoadingSessions,
  fetchSessions,
  fetchSessionScores,
  fetchScoresForSessions,
  deleteSession,
} = useQuizSessions()

const expandedSessionId = ref('')
const sessionScoresCache = reactive({})
const isLoadingSessionScores = ref(false)
const historyClassFilter = ref('all')
const historyDateFrom = ref('') // yyyy-mm-dd, tanggal mulai (inklusif)
const historyDateTo = ref('') // yyyy-mm-dd, tanggal akhir (inklusif)
const sessionSearch = ref('')

/** Class options come from live classes plus any names kept in history. */
const historyClassOptions = computed(() => {
  const names = new Set(classList.value.map((item) => item.name))
  sessions.value.forEach((session) => {
    if (session.class_name) names.add(session.class_name)
  })
  return [...names].sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }))
})

const filteredSessions = computed(() => {
  const from = historyDateFrom.value ? new Date(`${historyDateFrom.value}T00:00:00`) : null
  const to = historyDateTo.value ? new Date(`${historyDateTo.value}T23:59:59.999`) : null

  return sessions.value.filter((session) => {
    const matchClass =
      historyClassFilter.value === 'all' || session.class_name === historyClassFilter.value
    if (!matchClass) return false
    const keyword = sessionSearch.value.trim().toLowerCase()
    if (keyword) {
      const haystack = `${session.class_name ?? ''} ${session.subject_label ?? ''}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    const playedAt = new Date(session.played_at)
    if (from && playedAt < from) return false
    if (to && playedAt > to) return false
    return true
  })
})

function clearHistoryDate() {
  historyDateFrom.value = ''
  historyDateTo.value = ''
}

function formatPlayedAt(value) {
  try {
    return new Date(value).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(value ?? '')
  }
}

async function toggleSessionDetail(session) {
  if (expandedSessionId.value === session.id) {
    expandedSessionId.value = ''
    return
  }
  expandedSessionId.value = session.id
  if (sessionScoresCache[session.id]) return

  isLoadingSessionScores.value = true
  try {
    sessionScoresCache[session.id] = await fetchSessionScores(session.id)
  } catch (err) {
    showToast(err.message, 'error')
    expandedSessionId.value = ''
  } finally {
    isLoadingSessionScores.value = false
  }
}

function handleDeleteSession(session) {
  askConfirm(
    {
      title: 'Hapus Riwayat?',
      message: `Hasil game ${session.class_name} - ${session.subject_label} akan dihapus dari arsip.`,
      confirmLabel: 'Hapus',
      variant: 'danger',
    },
    async () => {
      await deleteSession(session.id)
      if (expandedSessionId.value === session.id) expandedSessionId.value = ''
      showToast('Riwayat berhasil dihapus.')
    },
  )
}

const isExportingHistory = ref(false)

/**
 * Ekspor riwayat yang sedang tampil (sesuai filter) ke CSV yang bisa dibuka
 * di Excel: satu baris per siswa per game.
 */
async function handleExportHistory() {
  const rows = filteredSessions.value
  if (rows.length === 0) {
    showToast('Tidak ada riwayat untuk diekspor.', 'error')
    return
  }

  isExportingHistory.value = true
  try {
    const scores = await fetchScoresForSessions(rows.map((session) => session.id))

    // Kelompokkan skor per sesi, urut dari poin tertinggi.
    const bySession = new Map()
    scores.forEach((row) => {
      if (!bySession.has(row.session_id)) bySession.set(row.session_id, [])
      bySession.get(row.session_id).push(row)
    })

    const csvRows = [
      ['Tanggal', 'Kelas', 'Materi', 'Jumlah Soal', 'Peringkat', 'Nama Siswa', 'Poin'],
    ]

    rows.forEach((session) => {
      const playedAt = new Date(session.played_at).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      const list = (bySession.get(session.id) ?? []).sort((a, b) => b.score - a.score)

      if (list.length === 0) {
        csvRows.push([playedAt, session.class_name, session.subject_label, session.question_count, '', 'Tanpa Pemain', ''])
        return
      }

      list.forEach((row, index) => {
        csvRows.push([
          playedAt,
          session.class_name,
          session.subject_label,
          session.question_count,
          index + 1,
          row.student_name,
          row.score,
        ])
      })
    })

    downloadCsv(datedFilename('riwayat-kuis'), csvRows)
    showToast(`Berhasil mengekspor ${rows.length} riwayat ke Excel.`)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    isExportingHistory.value = false
  }
}

// --------------------------------------------------------------- misc ------
function typeLabel(type) {
  return type === 'multiple_choice' ? 'Pilihan Ganda' : 'Isian Singkat'
}

onMounted(async () => {
  syncSettingsForm()
  await Promise.all([
    fetchStudents(),
    fetchQuestions(),
    fetchSubjects(),
    fetchClasses(),
    fetchSessions(),
    checkImageSupport(),
    checkTimeSupport(),
  ])
})
</script>

<template>
  <div class="mx-auto px-4 py-8 sm:px-6 lg:px-8">
    <!-- ============================== HEADER ============================== -->
    <header>
      <div>
        <p class="text-sm font-bold text-slate-400 sm:hidden">Selamat datang,</p>
        <h1 class="text-3xl font-extrabold text-slate-900 sm:text-4xl">Dashboard Guru</h1>
        <p class="mt-1 text-slate-500">Kelola siswa, soal, dan pengaturan kuis kelas.</p>
      </div>
    </header>

    <div class="mt-5 border-t border-slate-200"></div>

    <!-- ============================ TABS (desktop) ============================ -->
<!-- Navigation Tabs (Desktop) -->
    <nav class="mt-5 hidden flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:flex">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-extrabold transition active:scale-95"
        :class="
          activeTab === tab.id
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        "
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="20" aria-hidden="true" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <!-- Navigation Dropdown / Select (Mobile View Option) -->
    <div class="mt-4 sm:hidden">
      <label for="active-tab-select" class="sr-only">Pilih Tab Navigation</label>
      <select
        id="active-tab-select"
        v-model="activeTab"
        class="w-full rounded-2xl border-slate-200 bg-white p-3.5 text-base font-extrabold text-slate-800 shadow-sm ring-1 ring-slate-200/80 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      >
        <option v-for="tab in tabs" :key="tab.id" :value="tab.id">
          {{ tab.label }}
        </option>
      </select>
    </div>

    <div class="mt-5 hidden border-t border-slate-200 sm:block"></div>

    <!-- ========================= MENU UTAMA (mobile) ========================= -->
    <div class="mt-5 sm:hidden">
      <h2 class="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Menu Utama</h2>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <button
          v-for="tab in tabs.slice(0, 4)"
          :key="tab.id"
          type="button"
          class="flex min-h-[6.5rem] flex-col items-start justify-center gap-2 rounded-2xl p-4 text-left shadow-card transition active:scale-95"
          :class="activeTab === tab.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-800'"
          @click="activeTab = tab.id"
        >
          <span
            class="flex h-10 w-10 items-center justify-center rounded-xl"
            :class="activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600'"
          >
            <component :is="tab.icon" :size="22" aria-hidden="true" />
          </span>
          <span class="text-sm font-extrabold">{{ tab.label }}</span>
        </button>
      </div>
      <button
        type="button"
        class="mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left shadow-card transition active:scale-95"
        :class="activeTab === 'settings' ? 'bg-brand-600 text-white' : 'bg-white text-slate-800'"
        @click="activeTab = 'settings'"
      >
        <span
          class="flex h-10 w-10 items-center justify-center rounded-xl"
          :class="activeTab === 'settings' ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600'"
        >
          <Settings :size="22" aria-hidden="true" />
        </span>
        <span class="text-sm font-extrabold">Pengaturan Kuis</span>
      </button>
      <div class="mt-5 border-t border-slate-200"></div>
    </div>

    <!-- ============================== KELAS ============================== -->
<section v-if="activeTab === 'classes'" class="mt-6 space-y-6 animate-fade-in">
  <!-- Alert Migration -->
  <div v-if="classesNeedMigration" class="rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-300/70 shadow-sm">
    <p class="text-base font-extrabold text-amber-900 sm:text-lg">⚠️ Tabel kelas belum tersedia</p>
    <p class="mt-1 text-sm font-medium text-amber-800">
      Jalankan file <span class="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono font-bold text-amber-950">supabase/migration_classes.sql</span> di SQL Editor Supabase untuk mengaktifkan fitur kelas.
    </p>
  </div>

  <!-- Card 1: Form Tambah Kelas -->
  <div v-if="!classesNeedMigration" class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
      <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Tambah Kelas</h2>
      <InfoButton
        label="Info Tambah Kelas"
        @open="showInfo('Tambah Kelas', 'Buat, ubah nama, dan hapus kelas. Menghapus kelas ikut menghapus seluruh siswa beserta poinnya. Nama kelas tidak boleh sama.')"
      />
    </div>

    <form class="mt-5 flex flex-col gap-3.5 sm:flex-row sm:items-center" @submit.prevent="handleAddClass">
      <div class="flex-1">
        <input
          id="new-class-name"
          v-model="newClassName"
          type="text"
          class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-4 py-3 text-base font-semibold text-slate-800 placeholder-slate-400 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
          placeholder="Masukkan nama kelas, contoh: X-1"
          maxlength="60"
          aria-label="Nama kelas baru"
        />
      </div>
      <button
        type="submit"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50 whitespace-nowrap sm:w-auto"
        :disabled="isAddingClass"
      >
        <Plus :size="20" aria-hidden="true" />
        {{ isAddingClass ? 'Menyimpan...' : 'Tambah Kelas' }}
      </button>
    </form>

    <p v-if="classesError" class="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-500/10">
      {{ classesError }}
    </p>
  </div>

  <!-- Card 2: Daftar Kelas -->
  <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
      <div class="flex items-center gap-3">
        <h3 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          Daftar Kelas
        </h3>
        <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-inset ring-slate-500/10">
          {{ filteredClasses.length }} Kelas
        </span>
      </div>
    </div>

    <!-- Search input -->
    <div v-if="!isLoadingClasses && classList.length > 0" class="relative mt-5 w-full sm:max-w-md">
      <Search :size="18" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        v-model="classSearch"
        type="search"
        class="w-full rounded-xl border-slate-300 bg-slate-50/80 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
        placeholder="Cari nama kelas..."
        aria-label="Cari kelas"
      />
    </div>

    <!-- Loading state -->
    <div v-if="isLoadingClasses" class="py-12 text-center text-slate-500">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent"></div>
      <p class="mt-3 text-sm font-semibold text-slate-600">Memuat data kelas...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="classList.length === 0" class="py-12 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        ❓
      </div>
      <p class="mt-3 text-lg font-bold text-slate-800">Belum Ada Kelas</p>
      <p class="mt-1 text-sm font-medium text-slate-500">Tambahkan kelas baru dengan form di atas.</p>
    </div>

    <div v-else-if="filteredClasses.length === 0" class="py-12 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        ❓
      </div>
      <p class="mt-3 text-lg font-bold text-slate-800">Kelas Tidak Ditemukan</p>
      <p class="mt-1 text-sm font-medium text-slate-500">Coba ubah kata kunci pencarian kelas.</p>
    </div>

    <!-- List kelas -->
    <ul v-else class="mt-5 space-y-3">
      <li
        v-for="item in filteredClasses"
        :key="item.id"
        class="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/80 shadow-xs transition hover:bg-white hover:shadow-md hover:ring-indigo-300"
      >
        <!-- Mode Edit Nama Kelas -->
        <template v-if="editingClassId === item.id">
          <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              v-model="editClassName"
              type="text"
              class="flex-1 rounded-xl border-slate-300 bg-white px-3.5 py-2 text-base font-bold text-slate-800 outline-none ring-2 ring-indigo-500"
              maxlength="60"
              @keydown.enter.prevent="handleRenameClass"
              @keydown.esc="cancelRenameClass"
            />
            <div class="flex gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-95"
                :disabled="isSavingClass"
                @click="handleRenameClass"
              >
                {{ isSavingClass ? 'Simpan...' : 'Simpan' }}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300 active:scale-95"
                @click="cancelRenameClass"
              >
                Batal
              </button>
            </div>
          </div>
        </template>

        <!-- Mode Tampilan Normal -->
        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3">
                <span class="truncate text-base font-black text-slate-900 sm:text-lg">{{ item.name }}</span>
                <span class="inline-flex items-center rounded-lg bg-indigo-50/80 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                  👥 {{ classStudentCount(item.id) }} Siswa
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white active:scale-95 sm:text-sm"
                :title="`Ubah nama kelas ${item.name}`"
                :aria-label="`Ubah nama kelas ${item.name}`"
                @click="startRenameClass(item, $event)"
              >
                <Pencil :size="15" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white active:scale-95 sm:text-sm"
                :title="`Hapus kelas ${item.name}`"
                :aria-label="`Hapus kelas ${item.name}`"
                @click="handleDeleteClass(item, $event)"
              >
                <Trash2 :size="15" aria-hidden="true" />
                Hapus
              </button>
            </div>
          </div>
        </template>
      </li>
    </ul>
  </div>
</section>

    <!-- ============================== SISWA ============================== -->
<section v-else-if="activeTab === 'students'" class="mt-6 space-y-6 animate-fade-in">
  <!-- Card 1: Form Tambah Siswa -->
<div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
  <!-- Header: Judul di kiri, tombol Import di kanan -->
  <div class="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
    <div class="flex items-center gap-3">
      <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Tambah Siswa</h2>
      <InfoButton
        label="Info Tambah Siswa"
        @open="showInfo('Tambah Siswa', 'Tambah siswa ke kelasnya, pindahkan antar kelas, serta reset atau hapus siswa beserta poinnya. Nama siswa boleh sama asal beda kelas.')"
      />
    </div>

    <button
      type="button"
      class="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-600 hover:text-white active:scale-95 shrink-0"
      @click="showImportStudents = true"
    >
      <FileSpreadsheet :size="18" aria-hidden="true" />
      Import dari CSV / Excel
    </button>
  </div>

  <form class="mt-5 flex flex-col gap-3.5 sm:flex-row sm:items-center" @submit.prevent="handleAddStudent">
    <input
      v-model="newStudentName"
      type="text"
      class="flex-1 rounded-xl border-slate-300 bg-slate-50/80 px-4 py-3 text-base font-semibold text-slate-800 placeholder-slate-400 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
      placeholder="Nama lengkap siswa..."
      maxlength="60"
    />
    <select
      v-model="newStudentClassId"
      class="rounded-xl border-slate-300 bg-slate-50/80 px-4 py-3 text-base font-semibold text-slate-700 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 sm:w-60"
      aria-label="Kelas siswa baru"
    >
      <option value="" disabled>Pilih kelas...</option>
      <option v-for="item in classList" :key="item.id" :value="item.id">{{ item.name }}</option>
    </select>
    <button
      type="submit"
      class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50 whitespace-nowrap"
      :disabled="isAddingStudent"
    >
      <Plus :size="20" aria-hidden="true" />
      {{ isAddingStudent ? 'Menyimpan...' : 'Tambah Siswa' }}
    </button>
  </form>

  <p v-if="studentsError" class="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-500/10">
    {{ studentsError }}
  </p>
</div>

  <!-- Card 2: Daftar Siswa & Filter -->
  <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
      <div class="flex items-center gap-3">
        <h3 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          Daftar Siswa
        </h3>
        <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-inset ring-slate-500/10">
          {{ filteredStudents.length }} Siswa
        </span>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white active:scale-95 disabled:opacity-50"
        :disabled="students.length === 0"
        @click="handleResetAllScores"
      >
        <RotateCcw :size="18" aria-hidden="true" />
        Reset Semua Poin
      </button>
    </div>

    <!-- Filter & Search -->
    <div class="mt-5 flex flex-wrap items-center gap-3.5">
      <div class="w-full sm:w-60">
        <label class="mb-1 block text-xs font-bold text-slate-600">Filter Kelas</label>
        <select
          v-model="studentClassFilter"
          class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Filter kelas"
        >
          <option value="all">Semua Kelas</option>
          <option v-for="item in classList" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select>
      </div>

      <div class="relative w-full flex-1 sm:min-w-60">
        <label class="mb-1 block text-xs font-bold text-slate-600">Cari Siswa</label>
        <Search :size="18" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-[34px] text-slate-400" />
        <input
          v-model="studentSearch"
          type="search"
          class="w-full rounded-xl border-slate-300 bg-slate-50/80 pl-10 pr-4 py-2 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
          placeholder="Tulis nama siswa..."
          aria-label="Cari siswa"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingStudents" class="py-12 text-center text-slate-500">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent"></div>
      <p class="mt-3 text-sm font-semibold text-slate-600">Memuat data siswa...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredStudents.length === 0" class="py-12 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        ❓
      </div>
      <template v-if="students.length === 0">
        <p class="mt-3 text-lg font-bold text-slate-800">Belum Ada Siswa</p>
        <p class="mt-1 text-sm font-medium text-slate-500">Tambahkan siswa menggunakan form di atas.</p>
      </template>
      <template v-else>
        <p class="mt-3 text-lg font-bold text-slate-800">Siswa Tidak Ditemukan</p>
        <p class="mt-1 text-sm font-medium text-slate-500">Coba ubah kata kunci pencarian atau filter kelas.</p>
      </template>
    </div>

    <!-- Daftar Siswa List -->
    <ul v-else class="mt-5 space-y-3">
      <li
        v-for="student in filteredStudents"
        :key="student.id"
        class="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/80 shadow-xs transition hover:bg-white hover:shadow-md hover:ring-indigo-300 lg:flex lg:items-center lg:justify-between lg:gap-4"
      >
        <!-- Mode Edit Nama Siswa -->
        <template v-if="editingStudentId === student.id">
          <div class="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              v-model="editStudentName"
              type="text"
              class="flex-1 rounded-xl border-slate-300 bg-white px-3.5 py-2 text-base font-bold text-slate-800 outline-none ring-2 ring-indigo-500"
              maxlength="60"
              :aria-label="`Nama baru untuk ${student.name}`"
              @keydown.enter.prevent="handleRenameStudent"
              @keydown.esc="cancelRenameStudent"
            />
            <div class="flex gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-95"
                :disabled="isSavingStudent"
                @click="handleRenameStudent"
              >
                {{ isSavingStudent ? 'Simpan...' : 'Simpan' }}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300 active:scale-95"
                @click="cancelRenameStudent"
              >
                Batal
              </button>
            </div>
          </div>
        </template>

        <!-- Mode Tampilan Normal -->
        <template v-else>
          <div class="min-w-0 flex-1">
            <p class="truncate text-base font-black text-slate-900 sm:text-lg">{{ student.name }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2.5">
              <!-- Dropdown Pindah Kelas -->
              <select
                :value="student.class_id ?? ''"
                class="rounded-lg border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm sm:max-w-48"
                :aria-label="`Kelas ${student.name}`"
                @change="handleMoveStudent(student, $event)"
              >
                <option value="" disabled>Pilih kelas...</option>
                <option v-for="item in classList" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>

              <!-- Badge Poin Siswa -->
              <span class="inline-flex items-center rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20 sm:text-sm">
                🏆 {{ student.score }} Poin
              </span>
            </div>
          </div>

          <!-- Tombol Aksi Siswa -->
          <div class="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-3 lg:mt-0 lg:border-t-0 lg:pt-0">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white active:scale-95 sm:text-sm"
              :title="`Ubah nama ${student.name}`"
              :aria-label="`Ubah nama ${student.name}`"
              @click="startRenameStudent(student)"
            >
              <Pencil :size="15" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-600 hover:text-white active:scale-95 sm:text-sm"
              :title="`Reset poin ${student.name}`"
              :aria-label="`Reset poin ${student.name}`"
              @click="handleResetStudent(student)"
            >
              <RotateCcw :size="15" aria-hidden="true" />
              Reset Poin
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white active:scale-95 sm:text-sm"
              :title="`Hapus ${student.name}`"
              :aria-label="`Hapus ${student.name}`"
              @click="handleDeleteStudent(student)"
            >
              <Trash2 :size="15" aria-hidden="true" />
              Hapus
            </button>
          </div>
        </template>
      </li>
    </ul>
  </div>
</section>

    <!-- =============================== SOAL =============================== -->
    <section v-else-if="activeTab === 'questions'" class="mt-6 space-y-6 animate-fade-in">
      <!-- Peringatan bila tabel materi belum dimigrasi -->
      <div v-if="needsMigration" class="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <p class="font-extrabold text-amber-700">⚠️ Tabel materi belum tersedia</p>
        <p class="mt-1 text-amber-700">
          Jalankan file <span class="font-bold">supabase/migration_subjects.sql</span> di SQL Editor
          Supabase untuk mengaktifkan tambah/edit/hapus materi. Sementara ini daftar materi diambil
          dari soal yang sudah ada.
        </p>
      </div>

      <!-- Peringatan bila fitur gambar soal belum dimigrasi -->
      <div v-if="imageColumnAvailable === false" class="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <p class="font-extrabold text-amber-700">⚠️ Fitur gambar soal belum aktif</p>
        <p class="mt-1 text-amber-700">
          Jalankan file <span class="font-bold">supabase/migration_question_images.sql</span> di SQL
          Editor Supabase untuk mengaktifkan kolom gambar dan bucket penyimpanannya. Sementara ini
          soal tetap bisa disimpan, tetapi tanpa gambar.
        </p>
      </div>

      <!-- Peringatan bila batas waktu per soal belum dimigrasi -->
      <div v-if="timeColumnAvailable === false" class="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <p class="font-extrabold text-amber-700">⚠️ Batas waktu per soal belum aktif</p>
        <p class="mt-1 text-amber-700">
          Jalankan file <span class="font-bold">supabase/migration_question_time_limit.sql</span> di
          SQL Editor Supabase. Sementara ini semua soal memakai waktu global dan kolom Waktu
          diabaikan saat menyimpan.
        </p>
      </div>

      <p v-if="subjectsError" class="rounded-3xl bg-red-50 px-5 py-4 font-semibold text-red-600 ring-1 ring-red-200">
        {{ subjectsError }}
      </p>

      <!-- ==================== TINGKAT 1: DAFTAR MATERI ==================== -->
<template v-if="!activeSubject">
  <!-- Form Tambah Materi -->
  <div v-if="!needsMigration" class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
      <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Tambah Materi</h2>
      <InfoButton
        label="Info Tambah Materi"
        @open="showInfo('Tambah Materi', 'Kelola bank soal per materi. Buat materi dulu, lalu klik kartunya untuk menambah soal pilihan ganda atau isian singkat.')"
      />
    </div>

    <form class="mt-5 flex flex-col gap-3.5 sm:flex-row sm:items-center" @submit.prevent="handleAddSubject">
      <input
        v-model="newSubjectName"
        type="text"
        class="flex-1 rounded-xl border-slate-300 bg-slate-50/80 px-4 py-3 text-base font-semibold text-slate-800 placeholder-slate-400 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
        placeholder="Nama materi baru, contoh: Trigonometri"
        maxlength="60"
      />
      <button
        type="submit"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50 whitespace-nowrap sm:w-auto"
        :disabled="isAddingSubject"
      >
        <Plus :size="20" aria-hidden="true" />
        {{ isAddingSubject ? 'Menyimpan...' : 'Tambah Materi' }}
      </button>
    </form>
  </div>

  <!-- Loading State -->
  <div v-if="isLoadingSubjects || isLoadingQuestions" class="rounded-3xl bg-white p-12 text-center text-slate-500 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80">
    <div class="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent"></div>
    <p class="mt-3 text-sm font-semibold text-slate-600">Memuat data materi & soal...</p>
  </div>

  <!-- Empty State -->
  <div v-else-if="subjectCards.length === 0" class="rounded-3xl bg-white p-12 text-center shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80">
    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
      📘
    </div>
    <h3 class="mt-4 text-xl font-extrabold text-slate-900 sm:text-2xl">Belum Ada Materi</h3>
    <p class="mt-1 text-sm font-medium text-slate-500">Tambahkan materi baru dengan form di atas.</p>
  </div>

  <!-- Grid Cards Materi -->
  <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
    <div
      v-for="card in subjectCards"
      :key="card.id"
      role="button"
      tabindex="0"
      class="group relative flex cursor-pointer flex-col justify-between rounded-3xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-200/80 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:ring-indigo-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 active:scale-[0.98]"
      @click="openSubject(card.name)"
      @keydown.enter="openSubject(card.name)"
      @keydown.space.prevent="openSubject(card.name)"
    >
      <!-- Mode Edit Nama Materi -->
      <template v-if="editingSubjectId === card.id">
        <div class="w-full" @click.stop @keydown.stop>
          <label class="mb-1.5 block text-xs font-bold text-slate-600" :for="`rename-${card.id}`">Nama Materi</label>
          <input
            :id="`rename-${card.id}`"
            v-model="editSubjectName"
            type="text"
            class="w-full rounded-xl border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-800 outline-none ring-2 ring-indigo-500"
            maxlength="60"
            @keydown.enter.prevent="handleRenameSubject"
            @keydown.esc="cancelRenameSubject"
          />
          <div class="mt-3.5 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-95"
              :disabled="isSavingSubject"
              @click="handleRenameSubject"
            >
              {{ isSavingSubject ? 'Simpan...' : 'Simpan' }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl bg-slate-200 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-300 active:scale-95"
              @click="cancelRenameSubject"
            >
              Batal
            </button>
          </div>
        </div>
      </template>

      <!-- Mode Normal Card -->
      <template v-else>
        <div>
          <div class="flex items-start justify-between gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 ring-1 ring-inset ring-indigo-500/10 transition group-hover:bg-indigo-600 group-hover:text-white">
              📘
            </div>
            <span class="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
              {{ card.total }} Soal
            </span>
          </div>

          <h3 class="mt-4 text-lg font-black tracking-tight text-slate-900 group-hover:text-indigo-600 sm:text-xl">
            {{ card.name }}
          </h3>

          <div class="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-700">PG: {{ card.multipleChoice }}</span>
            <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-700">Isian: {{ card.shortAnswer }}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="!needsMigration" class="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3.5" @click.stop>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white active:scale-95"
            :title="`Ubah nama materi ${card.name}`"
            :aria-label="`Ubah nama materi ${card.name}`"
            @click="startRenameSubject(card, $event)"
          >
            <Pencil :size="14" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white active:scale-95"
            :title="`Hapus materi ${card.name}`"
            :aria-label="`Hapus materi ${card.name}`"
            @click="handleDeleteSubject(card, $event)"
          >
            <Trash2 :size="14" aria-hidden="true" />
            Hapus
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

      <!-- ============ TINGKAT 2: SOAL DALAM SEBUAH MATERI ============ -->
      <!-- Tampilan Detail Materi & Soal (Aktif saat materi dipilih) -->
  <div v-else class="space-y-6">
    <!-- Tombol kembali: di atas card, tanpa border, dengan shadow -->
    <button
      type="button"
      class="btn-neutral w-fit shadow-md ring-1 ring-slate-200/80 hover:shadow-lg !px-4 !py-2 !text-base transition active:scale-95"
      @click="backToSubjects"
    >
      <ArrowLeft :size="18" aria-hidden="true" />
      Kembali
    </button>

    <!-- Judul + info materi -->
    <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
      <div class="flex flex-wrap items-center justify-between gap-5">
        <!-- Informasi Materi Aktif -->
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-indigo-600">Materi Terpilih</span>
          <h2 class="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {{ activeSubject }}
          </h2>
        </div>

        <!-- Tombol Aksi Utama -->
        <div class="grid w-full grid-cols-1 gap-3 sm:w-auto sm:flex sm:flex-wrap sm:items-center">
          <!-- Tombol Import Word -->
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/80 px-5 py-3 text-sm font-bold text-blue-700 shadow-xs transition hover:bg-blue-600 hover:text-white active:scale-95 sm:text-base"
            @click="showImport = true"
          >
            <FileUp :size="20" aria-hidden="true" />
            <span>Import Word</span>
          </button>

          <!-- Tombol Tambah Soal -->
          <button
            v-if="!showQuestionForm"
            type="button"
            class="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700 active:scale-95 sm:text-base"
            @click="startAddQuestion"
          >
            <Plus :size="22" aria-hidden="true" />
            <span>Tambah Soal Manual</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Form soal sebagai modal (materinya sudah terkunci) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showQuestionForm"
          class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-md sm:items-center sm:p-4"
        >
          <div
            ref="questionDialogRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="q-form-title"
            tabindex="-1"
            class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl ring-1 ring-slate-900/10 focus:outline-none sm:rounded-[28px]"
          >
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div class="min-w-0">
                <h3 id="q-form-title" class="truncate text-xl font-extrabold tracking-tight text-slate-900">
                  {{ isEditMode ? 'Edit Soal' : 'Tambah Soal' }}
                </h3>
                <p class="mt-0.5 truncate text-xs font-semibold text-slate-500">
                  Materi: <span class="font-bold text-indigo-600">{{ activeSubject }}</span>
                  <span v-if="!isEditMode && questionStates.length > 1" class="text-slate-400">
                    • {{ questionStates.length }} soal disiapkan
                  </span>
                </p>
              </div>
              <button
                type="button"
                class="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
                aria-label="Tutup"
                @click="resetForm"
              >
                <X :size="20" aria-hidden="true" />
              </button>
            </div>

            <!-- Body Scrollable -->
            <div class="flex-1 overflow-y-auto bg-slate-50/80 p-4 sm:p-6">
              <div class="space-y-5">
                <section
                  v-for="(state, index) in questionStates"
                  :key="state.key"
                  class="relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 transition-all hover:shadow-md"
                >
                  <!-- Badge Soal & Hapus -->
                  <div class="flex items-center justify-between">
                    <span class="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                      Soal #{{ index + 1 }}
                    </span>
                    <button
                      v-if="!isEditMode && questionStates.length > 1"
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                      :aria-label="`Hapus kartu soal ${index + 1}`"
                      @click="removeQuestionCard(index)"
                    >
                      <X :size="18" aria-hidden="true" />
                    </button>
                  </div>

                  <!-- Form Controls: Tipe & Waktu -->
                  <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" :for="`q-type-${state.key}`">
                        Tipe Soal
                      </label>
                      <select
                        :id="`q-type-${state.key}`"
                        v-model="state.form.type"
                        class="w-full rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200/80 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="multiple_choice">Pilihan Ganda</option>
                        <option value="short_answer">Isian Singkat</option>
                      </select>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" :for="`q-time-${state.key}`">
                        Waktu (Detik)
                      </label>
                      <input
                        :id="`q-time-${state.key}`"
                        v-model="state.form.time_limit"
                        type="number"
                        min="0"
                        max="600"
                        class="w-full rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200/80 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Ikut Pengaturan Global"
                      />
                    </div>
                  </div>

                  <!-- Input Teks Pertanyaan -->
                  <div class="mt-4">
                    <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" :for="`q-text-${state.key}`">
                      Pertanyaan
                    </label>
                    <textarea
                      :id="`q-text-${state.key}`"
                      v-model="state.form.question_text"
                      rows="3"
                      class="w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200/80 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Tulis pertanyaan di sini..."
                    />

                    <!-- Preview LaTeX / Math -->
                    <div class="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm text-slate-700">
                      <span class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pratinjau Tampilan:</span>
                      <MathText v-if="state.form.question_text.trim()" :text="state.form.question_text" />
                      <span v-else class="text-xs italic text-slate-400">Pratinjau rumus/teks akan tampil di sini...</span>
                    </div>
                  </div>

                  <!-- Area Unggah Gambar -->
                  <div class="mt-4">
                    <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Gambar Lampiran <span class="font-normal text-slate-400">(opsional)</span>
                    </span>
                    <div
                      class="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition"
                      :class="[
                        imageColumnAvailable === false
                          ? 'border-slate-200 bg-slate-50 opacity-60'
                          : state.dragging
                            ? 'border-indigo-500 bg-indigo-50/50'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      ]"
                      @dragover.prevent="onQuestionImageDragOver(state)"
                      @dragenter.prevent="onQuestionImageDragOver(state)"
                      @dragleave="onQuestionImageDragLeave(state, $event)"
                      @drop.prevent="onQuestionImageDrop(state, $event)"
                    >
                      <!-- Tampilan Jika Gambar Ada -->
                      <div v-if="questionPreview(state)" class="group relative">
                        <img
                          :src="questionPreview(state)"
                          :alt="`Pratinjau gambar`"
                          class="max-h-48 rounded-xl object-contain ring-1 ring-slate-200"
                        />
                        <button
                          type="button"
                          class="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600 active:scale-90"
                          title="Hapus gambar"
                          @click="removeQuestionImage(state)"
                        >
                          <X :size="14" />
                        </button>
                      </div>

                      <!-- Placeholder Belum Ada Gambar -->
                      <template v-else>
                        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                          <ImagePlus :size="24" />
                        </div>
                        <p class="mt-2 text-xs font-bold text-slate-700">Tarik gambar ke sini, atau pilih dari perangkat</p>
                        <p class="text-[11px] font-semibold text-slate-400">PNG, JPG, WebP (Maks 5MB)</p>
                      </template>

                      <label
                        :for="`q-image-${state.key}`"
                        class="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
                        :class="{ 'pointer-events-none opacity-50': imageColumnAvailable === false }"
                      >
                        <ImagePlus :size="14" />
                        {{ questionPreview(state) ? 'Ganti Gambar' : 'Pilih File' }}
                        <input
                          :id="`q-image-${state.key}`"
                          :ref="(node) => setQuestionImageRef(state.key, node)"
                          type="file"
                          accept="image/*"
                          class="hidden"
                          :disabled="imageColumnAvailable === false"
                          @change="onQuestionImageSelect(state, $event)"
                        />
                      </label>
                    </div>
                  </div>

                  <!-- Options Pilihan Ganda -->
                  <div v-if="state.form.type === 'multiple_choice'" class="mt-5 space-y-2.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Pilihan Jawaban</span>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 transition hover:text-indigo-700 disabled:opacity-40"
                        :disabled="state.form.options.length >= MAX_OPTIONS"
                        @click="addOption(state)"
                      >
                        <Plus :size="14" /> Tambah Pilihan
                      </button>
                    </div>

                    <div
                      v-for="option in state.form.options"
                      :key="option.label"
                      class="flex flex-col gap-2 rounded-xl bg-slate-50/80 p-2.5 ring-1 ring-slate-200/60"
                    >
                      <div class="flex items-center gap-2">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100/70 text-sm font-extrabold text-indigo-700">
                          {{ option.label }}
                        </span>
                        <input
                          v-model="option.text"
                          type="text"
                          class="w-full min-w-0 rounded-lg border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200/80 transition focus:ring-2 focus:ring-indigo-500/20"
                          :placeholder="`Jawaban ${option.label}...`"
                        />
                        <button
                          type="button"
                          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200 transition hover:text-indigo-600 active:scale-90"
                          title="Tambah Gambar Opsi"
                          @click="pickOptionImage(state, option.label)"
                        >
                          <ImagePlus :size="16" />
                        </button>
                        <button
                          type="button"
                          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-600 active:scale-90 disabled:opacity-30"
                          :disabled="state.form.options.length <= 2"
                          @click="removeOption(state, option.label)"
                        >
                          <X :size="16" />
                        </button>
                      </div>

                      <!-- Math preview opsi -->
                      <div v-if="hasMath(option.text)" class="ml-11 rounded-lg bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200/60">
                        <MathText :text="option.text" />
                      </div>

                      <!-- Option Image Preview -->
                      <div v-if="optionPreview(option)" class="ml-11 flex items-center gap-2">
                        <img :src="optionPreview(option)" class="h-10 rounded-md object-contain ring-1 ring-slate-200" />
                        <button
                          type="button"
                          class="text-[11px] font-bold text-red-500 hover:underline"
                          @click="removeOptionImage(state, option)"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>

                  <input
                    :ref="(node) => setOptionImageRef(state.key, node)"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onOptionImageSelect(state, $event)"
                  />

                  <!-- Kunci Jawaban -->
                  <div class="mt-4">
                    <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500" :for="`q-answer-${state.key}`">
                      Kunci Jawaban Benar
                    </label>
                    <select
                      v-if="state.form.type === 'multiple_choice'"
                      :id="`q-answer-${state.key}`"
                      v-model="state.form.correct_answer"
                      class="w-full rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200/80 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="" disabled>-- Pilih Kunci Jawaban --</option>
                      <option
                        v-for="label in state.form.options.map((option) => option.label)"
                        :key="label"
                        :value="label"
                      >
                        Pilihan {{ label }}
                      </option>
                    </select>
                    <input
                      v-else
                      :id="`q-answer-${state.key}`"
                      v-model="state.form.correct_answer"
                      type="text"
                      class="w-full rounded-xl border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200/80 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Tulis jawaban pasti di sini..."
                    />
                  </div>
                </section>

                <!-- Tombol Tambah Card Soal Lagi -->
                <button
                  v-if="!isEditMode"
                  type="button"
                  class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-sm font-bold text-indigo-600 transition hover:border-indigo-400 hover:bg-indigo-50 active:scale-[0.99]"
                  @click="addQuestionCard"
                >
                  <Plus :size="18" /> Tambah Soal Lain
                </button>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                type="button"
                class="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 active:scale-95"
                @click="resetForm"
              >
                Batal
              </button>
              <button
                type="button"
                class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                :disabled="isSavingQuestion || questionStates.length === 0"
                @click="handleSaveAll"
              >
                {{ isSavingQuestion ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : `Simpan (${questionStates.length}) Soal` }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Daftar soal materi ini -->
    <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
      <!-- Header Card & Filter -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div class="flex items-center gap-3">
          <h3 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Daftar Soal
          </h3>
          <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-500/10 sm:text-sm">
            {{ subjectQuestions.length }} Soal
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- Select Filter Type -->
          <select
            v-model="filterType"
            class="rounded-xl border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none ring-1 ring-slate-200 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">Semua Tipe Soal</option>
            <option value="multiple_choice">Pilihan Ganda</option>
            <option value="short_answer">Isian Singkat</option>
          </select>

          <!-- Tombol Hapus Semua -->
          <button
            v-if="activeSubjectTotal > 0"
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 hover:text-red-700 active:scale-95"
            @click="handleDeleteAllQuestions"
          >
            <Trash2 :size="18" aria-hidden="true" />
            Hapus Semua Soal
          </button>
        </div>
      </div>

      <!-- Alert Error -->
      <p v-if="questionsError" class="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-500/10">
        {{ questionsError }}
      </p>

      <!-- Loading State -->
      <div v-if="isLoadingQuestions" class="flex flex-col items-center justify-center py-14 text-slate-400">
        <div class="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <p class="mt-3 text-sm font-bold text-slate-600">Memuat daftar soal...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="subjectQuestions.length === 0" class="flex flex-col items-center justify-center py-14 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl text-slate-400">
          ❓
        </div>
        <p class="mt-4 text-lg font-extrabold text-slate-800">Belum Ada Soal</p>
        <p class="mt-1 text-sm font-medium text-slate-500">
          {{ filterType === 'all' ? 'Tambahkan soal pertama untuk materi ini.' : 'Tidak ada soal dengan tipe filter tersebut.' }}
        </p>
      </div>

      <!-- Question List -->
      <ul v-else class="mt-5 space-y-5">
        <li
          v-for="question in subjectQuestions"
          :key="question.id"
          class="group relative rounded-2xl bg-slate-50/80 p-5 ring-1 ring-slate-200/80 transition hover:bg-white hover:shadow-md hover:ring-indigo-300 sm:p-6"
        >
          <!-- Badges Info Soal -->
          <div class="flex flex-wrap items-center gap-2.5">
            <span class="inline-flex items-center rounded-lg bg-slate-200/80 px-3 py-1 text-xs font-bold text-slate-800 sm:text-sm">
              {{ typeLabel(question.type) }}
            </span>
            <span class="inline-flex items-center rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20 sm:text-sm">
              Kunci: {{ question.correct_answer }}
            </span>
            <span
              v-if="question.time_limit !== null && question.time_limit !== undefined"
              class="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 ring-1 ring-inset ring-indigo-700/10 sm:text-sm"
            >
              ⏱ {{ question.time_limit === 0 ? 'Tanpa batas' : `${question.time_limit} Detik` }}
            </span>
          </div>

          <!-- Teks Pertanyaan -->
          <MathText class="mt-4 block text-base font-extrabold leading-relaxed text-slate-900 sm:text-lg" :text="question.question_text" />

          <!-- Gambar Lampiran Soal -->
          <img
            v-if="question.image_url"
            :src="question.image_url"
            :alt="question.question_text ? `Gambar untuk soal: ${question.question_text}` : 'Gambar soal'"
            class="mt-4 max-h-56 rounded-2xl object-contain ring-1 ring-slate-200"
          />

          <!-- Opsi Pilihan Ganda -->
          <div v-if="question.type === 'multiple_choice' && question.options" class="mt-4 space-y-2">
            <div
              v-for="option in question.options"
              :key="option.label"
              class="flex flex-col gap-1.5 rounded-xl bg-white p-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200/80 shadow-xs"
            >
              <div class="flex items-start gap-3">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-sm font-extrabold text-indigo-700">
                  {{ option.label }}
                </span>
                <span class="pt-0.5 leading-relaxed text-slate-800 sm:text-base">{{ option.text }}</span>
              </div>
              <img
                v-if="option.image"
                :src="option.image"
                :alt="`Gambar pilihan ${option.label}`"
                class="ml-10 mt-1 h-20 w-auto rounded-xl object-contain ring-1 ring-slate-200"
                loading="lazy"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-5 flex items-center justify-end gap-3 border-t border-slate-200/80 pt-4">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white active:scale-95"
              title="Edit soal ini"
              aria-label="Edit soal ini"
              @click="startEdit(question)"
            >
              <Pencil :size="17" aria-hidden="true" />
              Edit Soal
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white active:scale-95"
              title="Hapus soal ini"
              aria-label="Hapus soal ini"
              @click="handleDeleteQuestion(question)"
            >
              <Trash2 :size="17" aria-hidden="true" />
              Hapus
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</section>

    <!-- ============================ RIWAYAT ============================ -->
<section v-else-if="activeTab === 'history'" class="mt-6 space-y-6 animate-fade-in">
  <!-- Container Card dengan Shadow di Bagian Bawah -->
  <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <!-- Header Riwayat -->
    <div class="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Riwayat Game</h2>
        <InfoButton
          label="Info Riwayat Game"
          @open="showInfo('Riwayat Game', 'Setiap game yang selesai otomatis tersimpan di sini, lalu papan skor dinol-kan untuk game berikutnya.\n\nDaftar diurutkan dari yang terbaru. Klik salah satu untuk melihat peringkat akhirnya.\n\nTombol Ekspor menyimpan riwayat yang sedang tampil (sesuai filter) ke file Excel/CSV.')"
        />
      </div>

      <button
        v-if="sessions.length > 0"
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50 sm:text-base"
        :disabled="isExportingHistory || filteredSessions.length === 0"
        @click="handleExportHistory"
      >
        <Download :size="18" aria-hidden="true" />
        {{ isExportingHistory ? 'Mengekspor...' : 'Ekspor Excel' }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingSessions" class="py-12 text-center text-slate-500">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent"></div>
      <p class="mt-3 text-sm font-semibold text-slate-600">Memuat riwayat game...</p>
    </div>

    <!-- Empty State Global -->
    <div v-else-if="sessions.length === 0" class="py-12 text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
        ❓
      </div>
      <p class="mt-4 text-lg font-bold text-slate-800">Belum Ada Riwayat</p>
      <p class="mt-1 text-sm font-medium text-slate-500">Selesaikan satu game sampai tuntas untuk mengisi arsip.</p>
    </div>

    <template v-else>
      <!-- Controls Filter & Pencarian -->
      <div class="flex flex-wrap items-end gap-3.5" aria-label="Filter riwayat">
        <!-- Filter Kelas -->
        <div class="min-w-44 flex-1">
          <label class="mb-1 block text-xs font-bold text-slate-600" for="f-class">Pilih Kelas</label>
          <select
            id="f-class"
            v-model="historyClassFilter"
            class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Filter kelas"
          >
            <option value="all">Semua Kelas</option>
            <option v-for="name in historyClassOptions" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </div>

        <!-- Input Search -->
        <div class="relative min-w-56 flex-1">
          <label class="mb-1 block text-xs font-bold text-slate-600">Pencarian</label>
          <Search :size="18" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-[34px] text-slate-400" />
          <input
            v-model="sessionSearch"
            type="search"
            class="w-full rounded-xl border-slate-300 bg-slate-50/80 pl-10 pr-4 py-2 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Cari kelas atau materi..."
            aria-label="Cari riwayat"
          />
        </div>

        <!-- Filter Rentang Tanggal -->
        <div role="group" aria-label="Filter tanggal riwayat" class="grid w-full grid-cols-2 gap-3 sm:w-auto">
          <div>
            <label class="mb-1 block text-xs font-bold text-slate-600" for="f-from">Dari tanggal</label>
            <input
              id="f-from"
              v-model="historyDateFrom"
              type="date"
              class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold text-slate-600" for="f-to">Sampai tanggal</label>
            <input
              id="f-to"
              v-model="historyDateTo"
              type="date"
              class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-300 transition focus:border-indigo-500 focus:bg-white"
            />
          </div>
          <button
            v-if="historyDateFrom || historyDateTo"
            type="button"
            class="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
            @click="clearHistoryDate"
          >
            <X :size="16" aria-hidden="true" />
            Bersihkan Filter
          </button>
        </div>
      </div>

      <div class="mt-5 border-t border-slate-200/80"></div>

      <!-- Empty State Hasil Filter -->
      <div v-if="filteredSessions.length === 0" class="py-12 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
          🔍
        </div>
        <p class="mt-3 text-base font-bold text-slate-800">Tidak Ada Riwayat Cocok</p>
        <p class="mt-1 text-sm font-medium text-slate-500">Belum ada game tersimpan untuk filter pencarian ini.</p>
      </div>

      <!-- List Riwayat Game -->
      <ul v-else class="mt-5 space-y-3.5">
        <li
          v-for="session in filteredSessions"
          :key="session.id"
          class="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/80 shadow-xs transition hover:bg-white hover:shadow-md hover:ring-indigo-300 sm:p-5"
        >
          <button
            type="button"
            class="flex w-full flex-wrap items-center justify-between gap-3 text-left"
            @click="toggleSessionDetail(session)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-black text-slate-900 sm:text-lg">
                {{ session.class_name }} · {{ session.subject_label }}
              </span>
              <span class="mt-1 block text-xs font-bold text-slate-500 sm:text-sm">
                🗓 {{ formatPlayedAt(session.played_at) }} &bull; 📝 {{ session.question_count }} Soal
              </span>
            </span>
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white"
              :aria-label="expandedSessionId === session.id ? 'Tutup rincian' : 'Lihat rincian'"
            >
              <component
                :is="expandedSessionId === session.id ? ChevronUp : ChevronDown"
                :size="20"
                aria-hidden="true"
              />
            </span>
          </button>

          <!-- Detail Skor Per Sesi -->
          <div v-if="expandedSessionId === session.id" class="mt-4 border-t border-slate-200/80 pt-4">
            <div v-if="isLoadingSessionScores" class="py-4 text-center text-sm font-semibold text-slate-500">
              Memuat peringkat...
            </div>
            <div v-else-if="(sessionScoresCache[session.id] ?? []).length === 0" class="py-4 text-center text-sm font-medium text-slate-500">
              Tidak ada skor tersimpan untuk sesi ini.
            </div>
            <ul v-else class="space-y-2">
              <li
                v-for="(row, index) in sessionScoresCache[session.id]"
                :key="row.id"
                class="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/60 shadow-xs"
              >
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-black text-slate-600 text-xs sm:text-sm">
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-bold text-slate-800 sm:text-base">
                  {{ row.student_name }}
                </span>
                <span class="shrink-0 text-sm font-extrabold tabular-nums text-slate-900 sm:text-base">
                  {{ row.score }} <span class="text-xs font-bold text-slate-500">Poin</span>
                </span>
              </li>
            </ul>

            <div class="mt-4 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white active:scale-95 sm:text-sm"
                @click="handleDeleteSession(session)"
              >
                <Trash2 :size="16" aria-hidden="true" />
                Hapus Riwayat Ini
              </button>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </div>
</section>

    <!-- ============================ PENGATURAN ============================ -->
<section v-else class="mt-6 space-y-6 animate-fade-in">
  <!-- Card: Pengaturan Aturan Kuis -->
  <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
      <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Pengaturan Kuis</h2>
      <InfoButton
        label="Info Pengaturan Kuis"
        @open="showInfo('Pengaturan Kuis', 'Atur aturan permainan. Pengaturan ini tersimpan di browser ini.')"
      />
    </div>

    <div class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div>
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600" for="s-points">
          Poin per Jawaban Benar
        </label>
        <input
          id="s-points"
          v-model.number="settingsForm.pointsPerCorrect"
          type="number"
          min="1"
          max="100"
          class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-4 py-2.5 text-base font-extrabold text-slate-800 outline-none ring-1 ring-slate-300/80 transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600" for="s-count">
          Jumlah Soal per Kuis
        </label>
        <input
          id="s-count"
          v-model.number="settingsForm.questionCountPerQuiz"
          type="number"
          min="0"
          max="100"
          class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-4 py-2.5 text-base font-extrabold text-slate-800 outline-none ring-1 ring-slate-300/80 transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
        <p class="mt-1.5 text-xs font-semibold text-slate-400">Isi 0 untuk memakai semua soal pada materi tersebut.</p>
      </div>

      <div class="sm:col-span-2">
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600" for="s-time">
          Waktu Menjawab per Soal (detik)
        </label>
        <input
          id="s-time"
          v-model.number="settingsForm.answerTimeLimit"
          type="number"
          min="0"
          max="300"
          class="w-full rounded-xl border-slate-300 bg-slate-50/80 px-4 py-2.5 text-base font-extrabold text-slate-800 outline-none ring-1 ring-slate-300/80 transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
        <p class="mt-1.5 text-xs font-semibold text-slate-400">Isi 0 untuk tanpa batas waktu.</p>
      </div>
    </div>

    <div class="mt-6 space-y-3">
      <label class="flex cursor-pointer items-center gap-3.5 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/60 transition hover:bg-slate-100/80">
        <input
          v-model="settingsForm.shuffleQuestions"
          type="checkbox"
          class="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span class="text-sm font-bold text-slate-800">Acak urutan soal</span>
      </label>

      <label class="flex cursor-pointer items-center gap-3.5 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/60 transition hover:bg-slate-100/80">
        <input
          v-model="settingsForm.shuffleOptions"
          type="checkbox"
          class="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span class="text-sm font-bold text-slate-800">Acak urutan pilihan jawaban</span>
      </label>
    </div>
  </div>

  <!-- Card: Efek Suara -->
  <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Volume2 :size="20" aria-hidden="true" />
      </div>
      <h3 class="text-lg font-extrabold text-slate-900 sm:text-xl">Efek Suara</h3>
    </div>

    <div class="mt-5 space-y-5">
      <label class="flex cursor-pointer items-center gap-3.5">
        <input
          v-model="settingsForm.soundEnabled"
          type="checkbox"
          class="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span class="text-sm font-bold text-slate-800">Aktifkan efek suara</span>
      </label>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-600" for="s-volume">Volume Suara</label>
          <span class="text-xs font-black text-brand-600">{{ settingsForm.soundVolume }}%</span>
        </div>
        <input
          id="s-volume"
          v-model.number="settingsForm.soundVolume"
          type="range"
          min="0"
          max="100"
          step="5"
          class="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 disabled:opacity-40"
          :disabled="!settingsForm.soundEnabled"
        />
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50 sm:w-auto"
        :disabled="!settingsForm.soundEnabled"
        @click="handleTestSound"
      >
        <Volume2 :size="18" aria-hidden="true" />
        Tes Suara
      </button>
    </div>
  </div>

  <!-- Card: Musik Latar -->
  <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Music :size="20" aria-hidden="true" />
      </div>
      <h3 class="text-lg font-extrabold text-slate-900 sm:text-xl">Musik Latar</h3>
    </div>

    <div class="mt-5 space-y-5">
      <label class="flex cursor-pointer items-center gap-3.5">
        <input
          v-model="settingsForm.musicEnabled"
          type="checkbox"
          class="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span class="text-sm font-bold text-slate-800">Aktifkan musik latar</span>
      </label>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-600" for="s-music-volume">Volume Musik</label>
          <span class="text-xs font-black text-brand-600">{{ settingsForm.musicVolume }}%</span>
        </div>
        <input
          id="s-music-volume"
          v-model.number="settingsForm.musicVolume"
          type="range"
          min="0"
          max="100"
          step="5"
          class="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 disabled:opacity-40"
          :disabled="!settingsForm.musicEnabled"
        />
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50 sm:w-auto"
        :disabled="!settingsForm.musicEnabled"
        @click="toggleMusicPreview"
      >
        <Music :size="18" aria-hidden="true" />
        {{ isMusicPlaying ? 'Hentikan Pratinjau' : 'Pratinjau Musik' }}
      </button>
    </div>
  </div>

  <!-- Card: Action Buttons -->
  <div class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/80 sm:p-7">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-base font-bold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-700 active:scale-95"
        @click="handleSaveSettings"
      >
        Simpan Pengaturan
      </button>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl bg-slate-100 px-6 py-3 text-base font-bold text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-200 active:scale-95"
        @click="handleResetSettings"
      >
        Kembalikan Bawaan
      </button>
    </div>
  </div>
</section>

    <!-- =============================== TOAST =============================== -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast.show"
        class="fixed bottom-24 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl px-5 py-4
               text-center font-bold shadow-card-hover sm:bottom-6"
        :class="toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-900 text-white'"
        role="status"
      >
        {{ toast.message }}
      </div>
    </Transition>

    <ConfirmModal
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-label="confirmState.confirmLabel"
      :variant="confirmState.variant"
      :is-loading="confirmState.loading"
      @confirm="runConfirm"
      @cancel="cancelConfirm"
    />

    <ImportQuestionsModal
      v-if="showImport"
      :open="showImport"
      :subject="activeSubject"
      @close="showImport = false"
      @imported="onImported"
    />

    <ImportStudentsModal
      v-if="showImportStudents"
      :open="showImportStudents"
      :classes="classList"
      :default-class-id="studentClassFilter === 'all' ? '' : studentClassFilter"
      @close="showImportStudents = false"
      @imported="onStudentsImported"
    />

    <InfoModal
      :open="infoModal.open"
      :title="infoModal.title"
      :message="infoModal.message"
      @close="closeInfo"
    />
  </div>
</template>
