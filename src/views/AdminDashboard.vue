<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
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
    <nav class="mt-5 hidden flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-card sm:flex">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-extrabold transition"
        :class="activeTab === tab.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="18" aria-hidden="true" />
        {{ tab.label }}
      </button>
    </nav>

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
      <div v-if="classesNeedMigration" class="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <p class="font-extrabold text-amber-700">⚠️ Tabel kelas belum tersedia</p>
        <p class="mt-1 text-amber-700">
          Jalankan file <span class="font-bold">supabase/migration_classes.sql</span> di SQL Editor
          Supabase untuk mengaktifkan kuis per kelas.
        </p>
      </div>

      <div v-if="!classesNeedMigration" class="card">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-extrabold text-slate-900">Tambah Kelas</h2>
          <InfoButton
            label="Info Tambah Kelas"
            @open="showInfo('Tambah Kelas', 'Buat, ubah nama, dan hapus kelas. Menghapus kelas ikut menghapus seluruh siswa beserta poinnya. Nama kelas tidak boleh sama.')"
          />
        </div>

        <form class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="handleAddClass">
          <div class="flex-1">
            <input
              id="new-class-name"
              v-model="newClassName"
              type="text"
              class="input"
              placeholder="Masukkan nama kelas, contoh: X-1"
              maxlength="60"
              aria-label="Nama kelas baru"
            />
          </div>
          <button type="submit" class="btn-primary w-full whitespace-nowrap sm:w-auto" :disabled="isAddingClass">
            <Plus :size="20" aria-hidden="true" />
            {{ isAddingClass ? 'Menyimpan...' : 'Tambah Kelas' }}
          </button>
        </form>

        <p v-if="classesError" class="mt-4 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">
          {{ classesError }}
        </p>
      </div>

      <div class="card">
        <h3 class="text-lg font-extrabold text-slate-900">
          Daftar Kelas
          <span class="ml-1 text-slate-400">({{ filteredClasses.length }})</span>
        </h3>

        <div v-if="!isLoadingClasses && classList.length > 0" class="relative mt-4 w-full sm:max-w-sm">
          <Search :size="18" aria-hidden="true" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="classSearch"
            type="search"
            class="input !pl-11"
            placeholder="Cari kelas..."
            aria-label="Cari kelas"
          />
        </div>

        <div v-if="isLoadingClasses" class="py-10 text-center text-slate-500">Memuat...</div>

        <div v-else-if="classList.length === 0" class="py-10 text-center">
          <p class="text-4xl" aria-hidden="true">❓</p>
          <p class="mt-2 font-bold text-slate-700">Belum Ada Kelas</p>
          <p class="text-slate-500">Tambahkan kelas dengan form di atas.</p>
        </div>

        <div v-else-if="filteredClasses.length === 0" class="py-10 text-center">
          <p class="text-4xl" aria-hidden="true">❓</p>
          <p class="mt-2 font-bold text-slate-700">Kelas tidak ditemukan.</p>
          <p class="text-slate-500">Coba kata kunci lain.</p>
        </div>

        <ul v-else class="mt-4 space-y-3">
          <li v-for="item in filteredClasses" :key="item.id" class="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <template v-if="editingClassId === item.id">
              <div class="flex flex-col gap-2">
                <input
                  v-model="editClassName"
                  type="text"
                  class="input"
                  maxlength="60"
                  @keydown.enter.prevent="handleRenameClass"
                  @keydown.esc="cancelRenameClass"
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn-primary flex-1 whitespace-nowrap !px-4 !py-2 !text-base"
                    :disabled="isSavingClass"
                    @click="handleRenameClass"
                  >
                    {{ isSavingClass ? 'Menyimpan...' : 'Simpan' }}
                  </button>
                  <button
                    type="button"
                    class="btn-neutral flex-1 whitespace-nowrap !px-4 !py-2 !text-base"
                    @click="cancelRenameClass"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="flex items-center gap-3">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-extrabold text-slate-800">{{ item.name }}</span>
                  <span class="mt-0.5 block text-xs font-bold text-slate-400">
                    {{ classStudentCount(item.id) }} siswa
                  </span>
                </span>
                <button
                  type="button"
                  class="icon-btn-brand"
                  :title="`Ubah nama kelas ${item.name}`"
                  :aria-label="`Ubah nama kelas ${item.name}`"
                  @click="startRenameClass(item, $event)"
                >
                  <Pencil :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="icon-btn-danger"
                  :title="`Hapus kelas ${item.name}`"
                  :aria-label="`Hapus kelas ${item.name}`"
                  @click="handleDeleteClass(item, $event)"
                >
                  <Trash2 :size="18" aria-hidden="true" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================== SISWA ============================== -->
    <section v-else-if="activeTab === 'students'" class="mt-6 space-y-6 animate-fade-in">
      <div class="card">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-extrabold text-slate-900">Tambah Siswa</h2>
          <InfoButton
            label="Info Tambah Siswa"
            @open="showInfo('Tambah Siswa', 'Tambah siswa ke kelasnya, pindahkan antar kelas, serta reset atau hapus siswa beserta poinnya. Nama siswa boleh sama asal beda kelas.')"
          />
        </div>

        <form class="mt-5 flex flex-col gap-3 sm:flex-row" @submit.prevent="handleAddStudent">
          <input
            v-model="newStudentName"
            type="text"
            class="input flex-1"
            placeholder="Nama siswa..."
            maxlength="60"
          />
          <select v-model="newStudentClassId" class="input sm:w-56" aria-label="Kelas siswa baru">
            <option value="" disabled>Pilih kelas...</option>
            <option v-for="item in classList" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <button type="submit" class="btn-primary whitespace-nowrap" :disabled="isAddingStudent">
            <Plus :size="20" aria-hidden="true" />
            {{ isAddingStudent ? 'Menyimpan...' : 'Tambah Siswa' }}
          </button>
        </form>

        <p v-if="studentsError" class="mt-4 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">
          {{ studentsError }}
        </p>
      </div>

      <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-extrabold text-slate-900">
            Daftar Siswa
            <span class="ml-1 text-slate-400">({{ filteredStudents.length }})</span>
          </h3>
        </div>

        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div class="w-full sm:w-56">
            <select v-model="studentClassFilter" class="select sm:w-56" aria-label="Filter kelas">
              <option value="all">Semua Kelas</option>
              <option v-for="item in classList" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
          </div>

          <div class="relative w-full sm:w-56">
            <Search :size="18" aria-hidden="true" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="studentSearch"
              type="search"
              class="input !pl-11"
              placeholder="Cari siswa..."
              aria-label="Cari siswa"
            />
          </div>
        </div>

        <div class="mt-3 flex justify-end">
          <button
            type="button"
            class="btn-danger !px-4 !py-2 !text-sm"
            :disabled="students.length === 0"
            @click="handleResetAllScores"
          >
            <RotateCcw :size="18" aria-hidden="true" />
            Reset Semua Poin
          </button>
        </div>

        <div v-if="isLoadingStudents" class="py-10 text-center text-slate-500">Memuat...</div>

        <div v-else-if="filteredStudents.length === 0" class="py-10 text-center">
          <p class="text-4xl" aria-hidden="true">❓</p>
          <template v-if="students.length === 0">
            <p class="mt-2 font-bold text-slate-700">Belum Ada Siswa</p>
            <p class="text-slate-500">Tambahkan siswa dengan form di atas.</p>
          </template>
          <template v-else>
            <p class="mt-2 font-bold text-slate-700">Siswa tidak ditemukan.</p>
            <p class="text-slate-500">Coba kata kunci atau filter lain.</p>
          </template>
        </div>

        <ul v-else class="mt-4 space-y-3">
          <li v-for="student in filteredStudents" :key="student.id" class="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100 sm:flex sm:items-center sm:gap-3">
            <template v-if="editingStudentId === student.id">
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  v-model="editStudentName"
                  type="text"
                  class="input"
                  maxlength="60"
                  :aria-label="`Nama baru untuk ${student.name}`"
                  @keydown.enter.prevent="handleRenameStudent"
                  @keydown.esc="cancelRenameStudent"
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn-primary flex-1 whitespace-nowrap !px-4 !py-2 !text-base"
                    :disabled="isSavingStudent"
                    @click="handleRenameStudent"
                  >
                    {{ isSavingStudent ? 'Menyimpan...' : 'Simpan' }}
                  </button>
                  <button
                    type="button"
                    class="btn-neutral flex-1 whitespace-nowrap !px-4 !py-2 !text-base"
                    @click="cancelRenameStudent"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="min-w-0 flex-1">
                <p class="truncate text-base font-extrabold text-slate-800">{{ student.name }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    :value="student.class_id ?? ''"
                    class="input w-auto flex-1 py-2 text-base sm:max-w-48 sm:flex-none"
                    :aria-label="`Kelas ${student.name}`"
                    @change="handleMoveStudent(student, $event)"
                  >
                    <option value="" disabled>Pilih kelas...</option>
                    <option v-for="item in classList" :key="item.id" :value="item.id">{{ item.name }}</option>
                  </select>
                  <span class="chip bg-accent-100 text-accent-600">{{ student.score }} Poin</span>
                </div>
              </div>
              <div class="mt-2.5 flex shrink-0 gap-2 sm:mt-0">
                <button
                  type="button"
                  class="icon-btn-brand"
                  :title="`Ubah nama ${student.name}`"
                  :aria-label="`Ubah nama ${student.name}`"
                  @click="startRenameStudent(student)"
                >
                  <Pencil :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="icon-btn-brand"
                  :title="`Reset poin ${student.name}`"
                  :aria-label="`Reset poin ${student.name}`"
                  @click="handleResetStudent(student)"
                >
                  <RotateCcw :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="icon-btn-danger"
                  :title="`Hapus ${student.name}`"
                  :aria-label="`Hapus ${student.name}`"
                  @click="handleDeleteStudent(student)"
                >
                  <Trash2 :size="18" aria-hidden="true" />
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

      <p v-if="subjectsError" class="rounded-3xl bg-red-50 px-5 py-4 font-semibold text-red-600 ring-1 ring-red-200">
        {{ subjectsError }}
      </p>

      <!-- ==================== TINGKAT 1: DAFTAR MATERI ==================== -->
      <template v-if="!activeSubject">
        <!-- Form tambah materi: terpisah dari form soal -->
        <div v-if="!needsMigration" class="card">
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-extrabold text-slate-900">Tambah Materi</h2>
            <InfoButton
              label="Info Tambah Materi"
              @open="showInfo('Tambah Materi', 'Kelola bank soal per materi. Buat materi dulu, lalu klik kartunya untuk menambah soal pilihan ganda atau isian singkat.')"
            />
          </div>

          <form class="mt-4 flex flex-col gap-3 sm:flex-row" @submit.prevent="handleAddSubject">
            <input
              v-model="newSubjectName"
              type="text"
              class="input flex-1"
              placeholder="Nama materi baru, contoh: Trigonometri"
              maxlength="60"
            />
            <button type="submit" class="btn-primary whitespace-nowrap" :disabled="isAddingSubject">
              <Plus :size="20" aria-hidden="true" />
              {{ isAddingSubject ? 'Menyimpan...' : 'Tambah Materi' }}
            </button>
          </form>
        </div>

        <div v-if="isLoadingSubjects || isLoadingQuestions" class="card py-10 text-center text-slate-500">
          Memuat...
        </div>

        <div v-else-if="subjectCards.length === 0" class="card py-12 text-center">
          <p class="text-5xl" aria-hidden="true">❓</p>
          <h3 class="mt-3 text-2xl font-extrabold text-slate-900">Belum Ada Materi</h3>
          <p class="mt-2 text-slate-500">Tambahkan materi dengan form di atas.</p>
        </div>

        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="card in subjectCards"
            :key="card.id"
            role="button"
            tabindex="0"
            class="group flex cursor-pointer flex-col gap-2 rounded-3xl bg-white p-6 text-left shadow-card
                   transition duration-200 hover:-translate-y-1 hover:shadow-card-hover
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 active:scale-[0.98]"
            @click="openSubject(card.name)"
            @keydown.enter="openSubject(card.name)"
            @keydown.space.prevent="openSubject(card.name)"
          >
            <!-- Mode edit nama materi -->
            <template v-if="editingSubjectId === card.id">
              <div @click.stop @keydown.stop>
                <label class="label" :for="`rename-${card.id}`">Nama Materi</label>
                <input
                  :id="`rename-${card.id}`"
                  v-model="editSubjectName"
                  type="text"
                  class="input"
                  maxlength="60"
                  @keydown.enter.prevent="handleRenameSubject"
                  @keydown.esc="cancelRenameSubject"
                />
                <div class="mt-3 flex gap-2">
                  <button
                    type="button"
                    class="btn-primary flex-1 py-2 text-base"
                    :disabled="isSavingSubject"
                    @click="handleRenameSubject"
                  >
                    {{ isSavingSubject ? 'Menyimpan...' : 'Simpan' }}
                  </button>
                  <button type="button" class="btn-neutral flex-1 py-2 text-base" @click="cancelRenameSubject">
                    Batal
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <span class="text-3xl" aria-hidden="true">📘</span>
              <span class="text-xl font-extrabold text-slate-800 group-hover:text-brand-700">
                {{ card.name }}
              </span>
              <span class="chip w-fit bg-brand-50 text-brand-700">
                {{ card.total }} soal
              </span>
              <span class="text-sm font-semibold text-slate-400">
                Pilihan Ganda {{ card.multipleChoice }} · Isian {{ card.shortAnswer }}
              </span>

              <div v-if="!needsMigration" class="mt-2 flex gap-2" @click.stop>
                <button
                  type="button"
                  class="icon-btn-brand"
                  :title="`Ubah nama materi ${card.name}`"
                  :aria-label="`Ubah nama materi ${card.name}`"
                  @click="startRenameSubject(card, $event)"
                >
                  <Pencil :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="icon-btn-danger"
                  :title="`Hapus materi ${card.name}`"
                  :aria-label="`Hapus materi ${card.name}`"
                  @click="handleDeleteSubject(card, $event)"
                >
                  <Trash2 :size="18" aria-hidden="true" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- ============ TINGKAT 2: SOAL DALAM SEBUAH MATERI ============ -->
      <template v-else>
        <!-- Tombol kembali: di atas card, tanpa border, dengan shadow -->
        <button
          type="button"
          class="btn-neutral w-fit shadow-card ring-0 hover:shadow-card-hover !px-4 !py-2 !text-base"
          @click="backToSubjects"
        >
          <ArrowLeft :size="18" aria-hidden="true" />
          Kembali
        </button>

        <!-- Judul + info materi -->
        <div class="card">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-2xl font-extrabold text-slate-900">{{ activeSubject }}</h2>
              <p class="mt-1 text-slate-500">{{ subjectQuestions.length }} soal pada materi ini</p>
            </div>

            <div class="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
              <button
                type="button"
                class="btn-word !px-3 !py-2 !text-sm"
                @click="showImport = true"
              >
                <FileUp :size="18" aria-hidden="true" />
                Import Word
              </button>
              <button
                v-if="!showQuestionForm"
                type="button"
                class="btn-primary !px-3 !py-2 !text-sm"
                @click="startAddQuestion"
              >
                <Plus :size="20" aria-hidden="true" />
                Tambah Soal
              </button>
            </div>
          </div>
        </div>

        <!-- Form soal sebagai modal (materinya sudah terkunci) -->
        <Teleport to="body">
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            leave-active-class="transition duration-150 ease-in"
            leave-to-class="opacity-0"
          >
            <div
              v-if="showQuestionForm"
              class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            >
              <div
                ref="questionDialogRef"
                role="dialog"
                aria-modal="true"
                aria-labelledby="q-form-title"
                tabindex="-1"
                class="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-card-hover focus:outline-none sm:rounded-3xl"
              >
                <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                  <div class="min-w-0">
                    <h3 id="q-form-title" class="truncate text-lg font-extrabold text-slate-900 sm:text-xl">
                      {{ isEditMode ? 'Edit Soal' : 'Tambah Soal' }}
                    </h3>
                    <p class="mt-0.5 truncate text-sm text-slate-500">
                      Materi: <span class="font-bold text-brand-700">{{ activeSubject }}</span>
                      <span v-if="!isEditMode && questionStates.length > 1">
                        · {{ questionStates.length }} soal
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    class="icon-btn-neutral shrink-0"
                    aria-label="Tutup"
                    @click="resetForm"
                  >
                    <X :size="18" aria-hidden="true" />
                  </button>
                </div>

                <div class="flex-1 overflow-y-auto bg-slate-100 px-4 py-4 sm:px-6">
                  <div class="space-y-4">
                    <section
                      v-for="(state, index) in questionStates"
                      :key="state.key"
                      class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <span class="chip bg-brand-50 text-brand-700">Soal {{ index + 1 }}</span>
                        <button
                          v-if="!isEditMode && questionStates.length > 1"
                          type="button"
                          class="icon-btn-danger !h-9 !w-9"
                          :aria-label="`Hapus kartu soal ${index + 1}`"
                          @click="removeQuestionCard(index)"
                        >
                          <X :size="16" aria-hidden="true" />
                        </button>
                      </div>

                      <div class="mt-3">
                        <label class="label" :for="`q-type-${state.key}`">Tipe Soal</label>
                        <select :id="`q-type-${state.key}`" v-model="state.form.type" class="input">
                          <option value="multiple_choice">Pilihan Ganda</option>
                          <option value="short_answer">Isian Singkat</option>
                        </select>
                      </div>

            <div class="mt-4">
              <label class="label" :for="`q-text-${state.key}`">Pertanyaan</label>
              <textarea
                :id="`q-text-${state.key}`"
                v-model="state.form.question_text"
                class="input min-h-[7rem] leading-relaxed"
                placeholder="Tulis pertanyaan di sini..."
              />
              <div class="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div class="text-lg text-slate-800">
                  <MathText v-if="state.form.question_text.trim()" :text="state.form.question_text" />
                  <span v-else class="text-slate-400">Pratinjau soal muncul di sini.</span>
                </div>
              </div>
            </div>

            <div class="mt-4">
              <span class="label">Gambar Soal <span class="font-normal text-slate-400">(opsional)</span></span>

              <div
                class="rounded-2xl border-2 border-dashed p-5 text-center transition sm:p-6"
                :class="imageColumnAvailable === false
                  ? 'border-slate-200 bg-slate-50 opacity-60'
                  : state.dragging
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-slate-200 bg-slate-50/60'"
                @dragover.prevent="onQuestionImageDragOver(state)"
                @dragenter.prevent="onQuestionImageDragOver(state)"
                @dragleave="onQuestionImageDragLeave(state, $event)"
                @drop.prevent="onQuestionImageDrop(state, $event)"
              >
                <div v-if="questionPreview(state)" class="relative mx-auto w-fit">
                  <img
                    :src="questionPreview(state)"
                    :alt="`Pratinjau gambar soal: ${state.form.question_text || 'soal'}`"
                    class="max-h-56 w-auto rounded-2xl object-contain ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    class="absolute -right-2 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-full
                           bg-red-500 text-white shadow-card transition hover:bg-red-600 active:scale-95"
                    title="Hapus gambar"
                    aria-label="Hapus gambar"
                    @click="removeQuestionImage(state)"
                  >
                    <X :size="16" aria-hidden="true" />
                  </button>
                </div>

                <template v-else>
                  <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                    <ImagePlus :size="28" aria-hidden="true" />
                  </span>
                  <p class="mt-3 font-extrabold text-slate-700">Unggah Gambar Soal</p>
                  <p class="mt-1 text-sm text-slate-400">Tarik file ke sini atau pilih dari perangkat</p>
                </template>

                <div :class="questionPreview(state) ? 'mt-4' : 'mt-3'">
                  <label
                    :for="`q-image-${state.key}`"
                    class="btn-primary w-full !px-4 !py-2.5 !text-base sm:w-auto"
                    :class="imageColumnAvailable === false
                      ? 'pointer-events-none cursor-not-allowed opacity-50'
                      : 'cursor-pointer'"
                  >
                    <ImagePlus :size="18" aria-hidden="true" />
                    {{ questionPreview(state) ? 'Ganti Gambar' : 'Pilih Gambar' }}
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
                  <p class="mt-2.5 text-xs font-semibold text-slate-400">JPG, PNG, atau WebP (Maks. 5 MB)</p>
                </div>
              </div>
            </div>

            <div v-if="state.form.type === 'multiple_choice'" class="mt-4 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <p class="label mb-0">Pilihan Jawaban</p>
                <button
                  type="button"
                  class="btn-ghost !text-brand-600"
                  :disabled="state.form.options.length >= MAX_OPTIONS"
                  @click="addOption(state)"
                >
                  <Plus class="h-4 w-4" aria-hidden="true" />
                  Tambah Pilihan
                </button>
              </div>
              <div v-for="option in state.form.options" :key="option.label" class="rounded-2xl bg-slate-50 p-3">
                <div class="flex items-center gap-2">
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-extrabold text-brand-700">
                    {{ option.label }}
                  </span>
                  <input
                    v-model="option.text"
                    type="text"
                    class="input min-w-0 flex-1"
                    :placeholder="`Pilihan ${option.label}...`"
                    :aria-label="`Pilihan ${option.label} soal ${index + 1}`"
                  />
                  <button
                    type="button"
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 transition hover:bg-brand-50 hover:text-brand-700"
                    :title="`Gambar untuk pilihan ${option.label}`"
                    :aria-label="`Gambar untuk pilihan ${option.label} soal ${index + 1}`"
                    @click="pickOptionImage(state, option.label)"
                  >
                    <ImagePlus :size="18" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn-danger"
                    :disabled="state.form.options.length <= 2"
                    :title="`Hapus pilihan ${option.label}`"
                    :aria-label="`Hapus pilihan ${option.label} soal ${index + 1}`"
                    @click="removeOption(state, option.label)"
                  >
                    <X class="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <div v-if="hasMath(option.text)" class="mt-2 rounded-xl bg-white px-3 py-2 text-slate-800 ring-1 ring-slate-200">
                  <MathText :text="option.text" />
                </div>
                <div v-if="optionPreview(option)" class="mt-2 flex items-center gap-2">
                  <img
                    :src="optionPreview(option)"
                    :alt="`Gambar pilihan ${option.label}`"
                    class="h-14 w-auto rounded-xl object-contain ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    class="btn-ghost !px-2 !py-1 !text-sm !text-red-600"
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
              :aria-label="`Gambar pilihan jawaban soal ${index + 1}`"
              @change="onOptionImageSelect(state, $event)"
            />

            <div class="mt-4">
              <label class="label" :for="`q-answer-${state.key}`">Kunci Jawaban</label>
              <select
                v-if="state.form.type === 'multiple_choice'"
                :id="`q-answer-${state.key}`"
                v-model="state.form.correct_answer"
                class="input"
              >
                <option value="" disabled>Pilih kunci jawaban...</option>
                <option
                  v-for="label in state.form.options.map((option) => option.label)"
                  :key="label"
                  :value="label"
                >
                  {{ label }}
                </option>
              </select>
              <input
                v-else
                :id="`q-answer-${state.key}`"
                v-model="state.form.correct_answer"
                type="text"
                class="input"
                placeholder="Tulis jawaban yang benar..."
              />
            </div>
                    </section>

                    <!-- Tambah kartu soal lain -->
                    <button
                      v-if="!isEditMode"
                      type="button"
                      class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 font-extrabold text-brand-600 transition hover:border-brand-300 hover:bg-brand-50 active:scale-[0.99]"
                      @click="addQuestionCard"
                    >
                      <Plus :size="20" aria-hidden="true" />
                      Tambah Soal
                    </button>
                  </div>
                </div>

          <!-- Kaki fixed + divider -->
          <div class="flex items-center justify-between gap-3 border-t-2 border-slate-200 bg-white px-5 py-4 sm:px-6">
            <button type="button" class="btn-neutral" @click="resetForm">Batal</button>
            <button
              type="button"
              class="btn-primary"
              :disabled="isSavingQuestion || questionStates.length === 0"
              @click="handleSaveAll"
            >
              {{ isSavingQuestion ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : `Simpan ${questionStates.length} Soal` }}
            </button>
          </div>
              </div>
            </div>
          </Transition>
        </Teleport>

        <!-- Daftar soal materi ini -->
        <div class="card">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-extrabold text-slate-900">
              Daftar Soal <span class="ml-1 text-slate-400">({{ subjectQuestions.length }})</span>
            </h3>

            <div class="flex flex-wrap items-center gap-2">
              <select v-model="filterType" class="input w-auto py-2 text-base">
                <option value="all">Semua Tipe</option>
                <option value="multiple_choice">Pilihan Ganda</option>
                <option value="short_answer">Isian Singkat</option>
              </select>

              <button
                v-if="activeSubjectTotal > 0"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.98]"
                @click="handleDeleteAllQuestions"
              >
                <Trash2 :size="16" aria-hidden="true" />
                Hapus Semua Soal
              </button>
            </div>
          </div>

          <p v-if="questionsError" class="mt-4 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">
            {{ questionsError }}
          </p>

          <div v-if="isLoadingQuestions" class="py-10 text-center text-slate-500">Memuat...</div>

          <div v-else-if="subjectQuestions.length === 0" class="py-10 text-center">
            <p class="text-4xl" aria-hidden="true">❓</p>
            <p class="mt-2 font-bold text-slate-700">Belum Ada Soal</p>
            <p class="text-slate-500">
              {{ filterType === 'all' ? 'Tambahkan soal pertama untuk materi ini.' : 'Tidak ada soal dengan tipe itu.' }}
            </p>
          </div>

          <ul v-else class="mt-4 space-y-3">
            <li
              v-for="question in subjectQuestions"
              :key="question.id"
              class="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="chip bg-slate-200 text-slate-600">{{ typeLabel(question.type) }}</span>
                <span class="chip bg-emerald-100 text-emerald-700">Kunci: {{ question.correct_answer }}</span>
              </div>

              <MathText class="mt-3 block font-bold text-slate-800" :text="question.question_text" />

              <img
                v-if="question.image_url"
                :src="question.image_url"
                :alt="question.question_text ? `Gambar untuk soal: ${question.question_text}` : 'Gambar soal'"
                class="mt-3 max-h-40 w-auto rounded-xl object-contain ring-1 ring-slate-200"
              />

              <ul v-if="question.type === 'multiple_choice' && question.options" class="mt-2 space-y-1">
                <li v-for="option in question.options" :key="option.label" class="text-slate-600">
                  <span class="font-extrabold">{{ option.label }}.</span> {{ option.text }}
                  <img
                    v-if="option.image"
                    :src="option.image"
                    :alt="`Gambar pilihan ${option.label}`"
                    class="mt-1 block h-16 w-auto rounded-lg object-contain ring-1 ring-slate-200"
                    loading="lazy"
                  />
                </li>
              </ul>

              <div class="mt-3 flex gap-2">
                <button
                  type="button"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition hover:bg-brand-200 active:scale-95"
                  title="Edit soal ini"
                  aria-label="Edit soal ini"
                  @click="startEdit(question)"
                >
                  <Pencil :size="18" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 transition hover:bg-red-200 active:scale-95"
                  title="Hapus soal ini"
                  aria-label="Hapus soal ini"
                  @click="handleDeleteQuestion(question)"
                >
                  <Trash2 :size="18" aria-hidden="true" />
                </button>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </section>

    <!-- ============================ RIWAYAT ============================ -->
    <section v-else-if="activeTab === 'history'" class="mt-6 space-y-6 animate-fade-in">
      <div class="card">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-extrabold text-slate-900">Riwayat Game</h2>
            <InfoButton
              label="Info Riwayat Game"
              @open="showInfo('Riwayat Game', 'Setiap game yang selesai otomatis tersimpan di sini, lalu papan skor dinol-kan untuk game berikutnya.\n\nDaftar diurutkan dari yang terbaru. Klik salah satu untuk melihat peringkat akhirnya.\n\nTombol Ekspor menyimpan riwayat yang sedang tampil (sesuai filter) ke file Excel/CSV.')"
            />
          </div>

          <button
            v-if="sessions.length > 0"
            type="button"
            class="btn-neutral !px-4 !py-2 !text-base"
            :disabled="isExportingHistory || filteredSessions.length === 0"
            @click="handleExportHistory"
          >
            <Download :size="18" aria-hidden="true" />
            {{ isExportingHistory ? 'Mengekspor...' : 'Ekspor Excel' }}
          </button>
        </div>

        <div v-if="isLoadingSessions" class="py-10 text-center text-slate-500">Memuat...</div>

        <div v-else-if="sessions.length === 0" class="py-10 text-center">
          <p class="text-4xl" aria-hidden="true">❓</p>
          <p class="mt-2 font-bold text-slate-700">Belum Ada Riwayat</p>
          <p class="text-slate-500">Selesaikan satu game sampai tuntas untuk mengisi arsip.</p>
        </div>

        <template v-else>
          <div class="flex flex-wrap items-end gap-3" aria-label="Filter riwayat">
            <div class="min-w-40 flex-1">
              <select id="f-class" v-model="historyClassFilter" class="select" aria-label="Filter kelas">
                <option value="all">Semua Kelas</option>
                <option v-for="name in historyClassOptions" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
            </div>

            <div class="relative min-w-52 flex-1">
              <Search :size="18" aria-hidden="true" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="sessionSearch"
                type="search"
                class="input !pl-11"
                placeholder="Cari riwayat..."
                aria-label="Cari riwayat"
              />
            </div>

            <div role="group" aria-label="Filter tanggal riwayat" class="grid w-full grid-cols-2 gap-3">
              <div>
                <label class="label" for="f-from">Dari tanggal</label>
                <input id="f-from" v-model="historyDateFrom" type="date" class="input w-full py-2 text-base" />
              </div>
              <div>
                <label class="label" for="f-to">Sampai tanggal</label>
                <input id="f-to" v-model="historyDateTo" type="date" class="input w-full py-2 text-base" />
              </div>
              <button
                v-if="historyDateFrom || historyDateTo"
                type="button"
                class="btn-neutral col-span-2 w-full !py-3 !text-base sm:w-auto"
                @click="clearHistoryDate"
              >
                <X :size="18" aria-hidden="true" />
                Bersihkan Filter
              </button>
            </div>
          </div>

          <div class="mt-4 border-t border-slate-200"></div>

          <div v-if="filteredSessions.length === 0" class="py-10 text-center">
            <p class="text-4xl" aria-hidden="true">❓</p>
            <p class="mt-2 font-bold text-slate-700">Tidak Ada Riwayat</p>
            <p class="text-slate-500">Belum ada game tersimpan untuk filter ini.</p>
          </div>

          <ul v-else class="mt-4 space-y-3">
            <li
              v-for="session in filteredSessions"
              :key="session.id"
              class="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"
            >
              <button
                type="button"
                class="flex w-full flex-wrap items-center gap-3 text-left"
                @click="toggleSessionDetail(session)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-lg font-extrabold text-slate-800">
                    {{ session.class_name }} · {{ session.subject_label }}
                  </span>
                  <span class="mt-0.5 block text-sm font-semibold text-slate-400">
                    {{ formatPlayedAt(session.played_at) }} · {{ session.question_count }} soal
                  </span>
                </span>
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                  :aria-label="expandedSessionId === session.id ? 'Tutup rincian' : 'Lihat rincian'"
                >
                  <component
                    :is="expandedSessionId === session.id ? ChevronDown : ChevronUp"
                    :size="18"
                    aria-hidden="true"
                  />
                </span>
              </button>

            <div v-if="expandedSessionId === session.id" class="mt-3 border-t border-slate-200 pt-3">
              <div v-if="isLoadingSessionScores" class="py-4 text-center text-slate-500">
                Memuat...
              </div>
              <ul v-else-if="(sessionScoresCache[session.id] ?? []).length === 0" class="py-2 text-center text-slate-500">
                <p class="text-3xl" aria-hidden="true">❓</p>
                <p class="mt-1">Tidak ada skor tersimpan untuk sesi ini.</p>
              </ul>
              <ul v-else class="space-y-1.5">
                <li
                  v-for="(row, index) in sessionScoresCache[session.id]"
                  :key="row.id"
                  class="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100"
                >
                  <span class="w-6 shrink-0 text-center font-extrabold text-slate-400">{{ index + 1 }}</span>
                  <span class="min-w-0 flex-1 truncate font-bold text-slate-700">{{ row.student_name }}</span>
                  <span class="shrink-0 font-extrabold tabular-nums text-slate-700">
                    {{ row.score }} <span class="text-slate-400">Poin</span>
                  </span>
                </li>
              </ul>

              <div class="mt-3 text-right">
                <button
                  type="button"
                  class="btn-ghost text-red-600 hover:bg-red-50"
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
      <div class="card">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-extrabold text-slate-900">Pengaturan Kuis</h2>
          <InfoButton
            label="Info Pengaturan Kuis"
            @open="showInfo('Pengaturan Kuis', 'Atur aturan permainan. Pengaturan ini tersimpan di browser ini.')"
          />
        </div>

        <div class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label class="label" for="s-points">Poin per Jawaban Benar</label>
            <input id="s-points" v-model.number="settingsForm.pointsPerCorrect" type="number" min="1" max="100" class="input" />
          </div>

          <div>
            <label class="label" for="s-count">Jumlah Soal per Kuis</label>
            <input id="s-count" v-model.number="settingsForm.questionCountPerQuiz" type="number" min="0" max="100" class="input" />
            <p class="mt-1.5 text-sm text-slate-400">Isi 0 untuk memakai semua soal pada materi tersebut.</p>
          </div>

          <div class="sm:col-span-2">
            <label class="label" for="s-time">Waktu Menjawab per Soal (detik)</label>
            <input id="s-time" v-model.number="settingsForm.answerTimeLimit" type="number" min="0" max="300" class="input" />
            <p class="mt-1.5 text-sm text-slate-400">Isi 0 untuk tanpa batas waktu.</p>
          </div>
        </div>

        <div class="mt-5 space-y-3">
          <label class="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <input v-model="settingsForm.shuffleQuestions" type="checkbox" class="h-5 w-5 rounded text-brand-600" />
            <span class="font-bold text-slate-700">Acak urutan soal</span>
          </label>

          <label class="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <input v-model="settingsForm.shuffleOptions" type="checkbox" class="h-5 w-5 rounded text-brand-600" />
            <span class="font-bold text-slate-700">Acak urutan pilihan jawaban</span>
          </label>
        </div>
      </div>

      <div class="card">
        <h3 class="text-lg font-extrabold text-slate-900">Efek Suara</h3>

        <div class="mt-5 space-y-4">
          <label class="flex cursor-pointer items-center gap-3">
            <input v-model="settingsForm.soundEnabled" type="checkbox" class="h-5 w-5 rounded text-brand-600" />
            <span class="font-bold text-slate-700">Aktifkan efek suara</span>
          </label>

          <div>
            <label class="label" for="s-volume">Volume Suara ({{ settingsForm.soundVolume }}%)</label>
            <input
              id="s-volume"
              v-model.number="settingsForm.soundVolume"
              type="range"
              min="0"
              max="100"
              step="5"
              class="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600"
              :disabled="!settingsForm.soundEnabled"
            />
          </div>

          <button
            type="button"
            class="btn-neutral w-full py-2.5 text-base sm:w-auto"
            :disabled="!settingsForm.soundEnabled"
            @click="handleTestSound"
          >
            <Volume2 :size="18" aria-hidden="true" /> Tes Suara
          </button>
        </div>
      </div>

      <div class="card">
        <h3 class="text-lg font-extrabold text-slate-900">Musik Latar</h3>

        <div class="mt-5 space-y-4">
          <label class="flex cursor-pointer items-center gap-3">
            <input v-model="settingsForm.musicEnabled" type="checkbox" class="h-5 w-5 rounded text-brand-600" />
            <span class="font-bold text-slate-700">Aktifkan musik latar</span>
          </label>

          <div>
            <label class="label" for="s-music-volume">Volume Musik ({{ settingsForm.musicVolume }}%)</label>
            <input
              id="s-music-volume"
              v-model.number="settingsForm.musicVolume"
              type="range"
              min="0"
              max="100"
              step="5"
              class="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600"
              :disabled="!settingsForm.musicEnabled"
            />
          </div>

          <button
            type="button"
            class="btn-neutral w-full py-2.5 text-base sm:w-auto"
            :disabled="!settingsForm.musicEnabled"
            @click="toggleMusicPreview"
          >
            <Music :size="18" aria-hidden="true" />
            {{ isMusicPlaying ? 'Hentikan Pratinjau' : 'Pratinjau Musik' }}
          </button>
        </div>
      </div>

      <div class="card">
        <div class="flex flex-col gap-3 sm:flex-row">
          <button type="button" class="btn-primary" @click="handleSaveSettings">Simpan Pengaturan</button>
          <button type="button" class="btn-neutral" @click="handleResetSettings">Kembalikan Bawaan</button>
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

    <InfoModal
      :open="infoModal.open"
      :title="infoModal.title"
      :message="infoModal.message"
      @close="closeInfo"
    />
  </div>
</template>
