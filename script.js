import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/**
 * =========================
 * 1) ВСТАВЬ СВОИ ДАННЫЕ
 * =========================
 * Project URL и anon key возьми в Supabase:
 * Project Settings -> Data API
 */
const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE';

/**
 * Укажи URL сайта после деплоя.
 * Для GitHub Pages это обычно:
 * https://USERNAME.github.io/REPO_NAME/
 *
 * Для Vercel:
 * https://your-project.vercel.app/
 */
const SITE_URL = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/') ;

if (SUPABASE_URL.includes('PASTE_') || SUPABASE_ANON_KEY.includes('PASTE_')) {
  alert('Сначала открой script.js и вставь SUPABASE_URL и SUPABASE_ANON_KEY.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  session: null,
  profile: null,
  topics: [],
  topicProgress: new Map(),
  currentTopic: null,
  currentQuestionIndex: 0,
  currentQuestions: [],
  selectedOption: null,
  currentProgressRow: null
};

// =========================
// DOM
// =========================
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authCard = document.getElementById('authCard');
const userArea = document.getElementById('userArea');
const profileBtn = document.getElementById('profileBtn');
const profileMenu = document.getElementById('profileMenu');
const logoutBtn = document.getElementById('logoutBtn');
const guestHero = document.getElementById('guestHero');
const topicsCard = document.getElementById('topicsCard');
const topicsGrid = document.getElementById('topicsGrid');
const questionCard = document.getElementById('questionCard');
const questionMeta = document.getElementById('questionMeta');
const questionTitle = document.getElementById('questionTitle');
const questionText = document.getElementById('questionText');
const optionsWrap = document.getElementById('optionsWrap');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const questionFeedback = document.getElementById('questionFeedback');
const backToTopicsBtn = document.getElementById('backToTopicsBtn');
const progressCard = document.getElementById('progressCard');
const progressBadge = document.getElementById('progressBadge');
const solvedCount = document.getElementById('solvedCount');
const failedCount = document.getElementById('failedCount');
const allCount = document.getElementById('allCount');
const questionProgressFill = document.getElementById('questionProgressFill');
const adminCard = document.getElementById('adminCard');
const adminTableBody = document.getElementById('adminTableBody');
const refreshAdminBtn = document.getElementById('refreshAdminBtn');

const profileInitial = document.getElementById('profileInitial');
const menuRealName = document.getElementById('menuRealName');
const menuEmail = document.getElementById('menuEmail');
const menuUsername = document.getElementById('menuUsername');
const menuRole = document.getElementById('menuRole');

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

function setActiveTab(tab) {
  if (tab === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

loginTab.addEventListener('click', () => setActiveTab('login'));
registerTab.addEventListener('click', () => setActiveTab('register'));

profileBtn.addEventListener('click', () => {
  profileMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
    profileMenu.classList.add('hidden');
  }
});

loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
logoutBtn.addEventListener('click', handleLogout);
submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
nextQuestionBtn.addEventListener('click', goToNextQuestion);
backToTopicsBtn.addEventListener('click', showTopicsView);
refreshAdminBtn.addEventListener('click', loadAdminStats);

// =========================
// AUTH
// =========================
async function handleRegister(e) {
  e.preventDefault();

  const username = document.getElementById('regUsername').value.trim();
  const realName = document.getElementById('regRealName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: SITE_URL,
        data: {
          username,
          real_name: realName
        }
      }
    });

    if (error) throw error;

    showToast('Аккаунт создан. Проверь почту и подтверди email.');
    registerForm.reset();
    setActiveTab('login');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Ошибка регистрации');
  }
}

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    showToast('Вход выполнен');
    loginForm.reset();
    await bootstrap();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Ошибка входа');
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.session = null;
  state.profile = null;
  renderGuestState();
  showToast('Вы вышли из аккаунта');
}

async function upsertProfile(userId, profileData) {
  const payload = {
    id: userId,
    username: profileData.username,
    real_name: profileData.real_name,
    email: profileData.email,
    role: profileData.role || 'student'
  };

  const { error } = await supabase.from('profiles').upsert(payload);
  if (error) throw error;
}

// =========================
// INITIAL LOAD
// =========================
supabase.auth.onAuthStateChange(async (_event, session) => {
  state.session = session;
  await bootstrap();
});

window.addEventListener('load', bootstrap);

async function bootstrap() {
  const { data: { session } } = await supabase.auth.getSession();
  state.session = session || null;

  if (!state.session?.user) {
    renderGuestState();
    return;
  }

  await ensureProfile();
  await loadTopics();
  await loadUserProgress();
  renderAuthenticatedState();

  if (state.profile?.role === 'admin') {
    await loadAdminStats();
  }
}

async function ensureProfile() {
  const user = state.session.user;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    showToast('Не удалось загрузить профиль');
    return;
  }

  if (!data) {
    const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
    const realName = user.user_metadata?.real_name || user.email || 'Student';

    try {
      await upsertProfile(user.id, {
        username,
        real_name: realName,
        email: user.email,
        role: 'student'
      });

      state.profile = {
        id: user.id,
        username,
        real_name: realName,
        email: user.email,
        role: 'student'
      };
    } catch (err) {
      console.error(err);
    }
  } else {
    state.profile = data;
  }
}

async function loadTopics() {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) {
    console.error(error);
    showToast('Не удалось загрузить темы');
    return;
  }

  state.topics = data || [];
}

async function loadUserProgress() {
  const { data, error } = await supabase
    .from('question_progress')
    .select('question_id, status, attempts_used')
    .eq('user_id', state.profile.id);

  if (error) {
    console.error(error);
    showToast('Не удалось загрузить прогресс');
    return;
  }

  state.topicProgress = new Map();
  const progressByQuestion = new Map((data || []).map(row => [row.question_id, row]));

  for (const topic of state.topics) {
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, topic_id')
      .eq('topic_id', topic.id)
      .order('order_index', { ascending: true });

    if (qError) {
      console.error(qError);
      continue;
    }

    const solved = questions.filter(q => progressByQuestion.get(q.id)?.status === 'solved').length;
    const failed = questions.filter(q => progressByQuestion.get(q.id)?.status === 'failed').length;
    const total = questions.length;

    state.topicProgress.set(topic.id, {
      solved,
      failed,
      total
    });
  }

  updateOverallStats(data || []);
}

// =========================
// RENDERING
// =========================
function renderGuestState() {
  authCard.classList.remove('hidden');
  guestHero.classList.remove('hidden');
  topicsCard.classList.add('hidden');
  questionCard.classList.add('hidden');
  userArea.classList.add('hidden');
  progressCard.classList.add('hidden');
  adminCard.classList.add('hidden');
}

function renderAuthenticatedState() {
  authCard.classList.add('hidden');
  guestHero.classList.add('hidden');
  topicsCard.classList.remove('hidden');
  userArea.classList.remove('hidden');
  progressCard.classList.remove('hidden');

  profileInitial.textContent = (state.profile?.real_name || 'U').trim().charAt(0).toUpperCase();
  menuRealName.textContent = state.profile?.real_name || '—';
  menuEmail.textContent = state.profile?.email || '—';
  menuUsername.textContent = state.profile?.username || '—';
  menuRole.textContent = state.profile?.role || 'student';

  adminCard.classList.toggle('hidden', state.profile?.role !== 'admin');

  renderTopics();
}

function renderTopics() {
  topicsGrid.innerHTML = '';

  state.topics.forEach(topic => {
    const box = document.createElement('div');
    box.className = 'topic-card';

    const stats = state.topicProgress.get(topic.id) || { solved: 0, failed: 0, total: 0 };
    const completed = stats.solved + stats.failed;
    const nextLabel = completed >= stats.total ? 'Завершено' : `Доступно: ${Math.min(completed + 1, stats.total)}/${stats.total}`;

    box.innerHTML = `
      <div>
        <h3>${escapeHtml(topic.title)}</h3>
        <p>${escapeHtml(topic.description || 'Тема по pre-algebra')}</p>
      </div>
      <div class="topic-foot">
        <span class="small-badge">${stats.solved} solved · ${stats.failed} failed</span>
        <span class="muted">${nextLabel}</span>
      </div>
      <button class="primary-btn">Открыть тему</button>
    `;

    box.querySelector('button').addEventListener('click', () => openTopic(topic));
    topicsGrid.appendChild(box);
  });
}

async function openTopic(topic) {
  state.currentTopic = topic;
  state.currentQuestionIndex = 0;
  state.selectedOption = null;

  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('topic_id', topic.id)
    .order('order_index', { ascending: true });

  if (error) {
    console.error(error);
    showToast('Не удалось загрузить задачи темы');
    return;
  }

  state.currentQuestions = data || [];

  if (!state.currentQuestions.length) {
    showToast('В этой теме пока нет задач');
    return;
  }

  const { data: progressRows } = await supabase
    .from('question_progress')
    .select('*')
    .eq('user_id', state.profile.id)
    .in('question_id', state.currentQuestions.map(q => q.id));

  const progressMap = new Map((progressRows || []).map(row => [row.question_id, row]));

  const firstOpenIndex = state.currentQuestions.findIndex(q => {
    const row = progressMap.get(q.id);
    return !row || row.status === 'not_started';
  });

  state.currentQuestionIndex = firstOpenIndex === -1 ? state.currentQuestions.length - 1 : firstOpenIndex;
  questionCard.classList.remove('hidden');
  topicsCard.classList.add('hidden');

  await renderCurrentQuestion();
}

async function renderCurrentQuestion() {
  const question = state.currentQuestions[state.currentQuestionIndex];
  if (!question) return;

  state.selectedOption = null;
  nextQuestionBtn.classList.add('hidden');
  submitAnswerBtn.disabled = false;

  const { data: progressRow } = await supabase
    .from('question_progress')
    .select('*')
    .eq('user_id', state.profile.id)
    .eq('question_id', question.id)
    .maybeSingle();

  state.currentProgressRow = progressRow || null;

  const percentage = ((state.currentQuestionIndex + 1) / state.currentQuestions.length) * 100;
  questionProgressFill.style.width = `${percentage}%`;

  questionMeta.textContent = `${state.currentTopic.title} · Задача ${state.currentQuestionIndex + 1} из ${state.currentQuestions.length}`;
  questionTitle.textContent = `Вопрос ${question.order_index}`;
  questionText.textContent = question.question_text;

  const options = [
    { key: 'A', value: question.option_a },
    { key: 'B', value: question.option_b },
    { key: 'C', value: question.option_c },
    { key: 'D', value: question.option_d }
  ];

  optionsWrap.innerHTML = '';
  options.forEach(opt => {
    const node = document.createElement('div');
    node.className = 'option';
    node.dataset.option = opt.key;
    node.innerHTML = `
      <div class="option-letter">${opt.key}</div>
      <div>${escapeHtml(opt.value)}</div>
    `;

    if (progressRow?.status === 'solved' && progressRow.last_selected_option === opt.key) {
      node.classList.add('correct');
    }

    if (progressRow?.status === 'failed') {
      if (opt.key === question.correct_option) node.classList.add('correct');
      if (opt.key === progressRow.last_selected_option && opt.key !== question.correct_option) node.classList.add('wrong');
    }

    node.addEventListener('click', () => {
      if (progressRow?.status === 'solved' || progressRow?.status === 'failed') return;
      document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
      node.classList.add('selected');
      state.selectedOption = opt.key;
    });

    optionsWrap.appendChild(node);
  });

  if (progressRow?.status === 'solved') {
    showFeedback('success', `Верно. Ты уже решил эту задачу.`);
    submitAnswerBtn.disabled = true;
    nextQuestionBtn.classList.remove('hidden');
  } else if (progressRow?.status === 'failed') {
    showFeedback('error', `Эта задача уже закрыта после 2 ошибок. Правильный ответ: ${question.correct_option}.`);
    submitAnswerBtn.disabled = true;
    nextQuestionBtn.classList.remove('hidden');
  } else {
    const attemptsText = progressRow ? `Попыток использовано: ${progressRow.attempts_used}/2` : 'Попыток использовано: 0/2';
    showFeedback('info', attemptsText);
  }
}

function showFeedback(type, text) {
  questionFeedback.className = `feedback ${type}`;
  questionFeedback.textContent = text;
  questionFeedback.classList.remove('hidden');
}

function showTopicsView() {
  questionCard.classList.add('hidden');
  topicsCard.classList.remove('hidden');
  renderTopics();
}

// =========================
// SUBMIT ANSWER
// =========================
async function handleSubmitAnswer() {
  const question = state.currentQuestions[state.currentQuestionIndex];
  const progressRow = state.currentProgressRow;

  if (!question) return;
  if (!state.selectedOption) {
    showToast('Сначала выбери один вариант');
    return;
  }

  if (progressRow?.status === 'solved' || progressRow?.status === 'failed') {
    return;
  }

  const nextAttemptNumber = (progressRow?.attempts_used || 0) + 1;
  const isCorrect = state.selectedOption === question.correct_option;

  try {
    const { error: attemptError } = await supabase.from('attempts').insert({
      user_id: state.profile.id,
      question_id: question.id,
      attempt_number: nextAttemptNumber,
      selected_option: state.selectedOption,
      is_correct: isCorrect
    });
    if (attemptError) throw attemptError;

    if (isCorrect) {
      const { error: progressError } = await supabase.from('question_progress').upsert({
        user_id: state.profile.id,
        question_id: question.id,
        status: 'solved',
        attempts_used: nextAttemptNumber,
        last_selected_option: state.selectedOption,
        finished_at: new Date().toISOString()
      }, { onConflict: 'user_id,question_id' });
      if (progressError) throw progressError;

      showFeedback('success', `Правильно. Задача решена ${nextAttemptNumber === 1 ? 'с первой' : 'со второй'} попытки.`);
      colorizeOptions(question.correct_option, state.selectedOption);
      submitAnswerBtn.disabled = true;
      nextQuestionBtn.classList.remove('hidden');
    } else if (nextAttemptNumber >= 2) {
      const { error: progressError } = await supabase.from('question_progress').upsert({
        user_id: state.profile.id,
        question_id: question.id,
        status: 'failed',
        attempts_used: nextAttemptNumber,
        last_selected_option: state.selectedOption,
        finished_at: new Date().toISOString()
      }, { onConflict: 'user_id,question_id' });
      if (progressError) throw progressError;

      showFeedback('error', `Неправильно. Это была вторая ошибка. Правильный ответ: ${question.correct_option}.`);
      colorizeOptions(question.correct_option, state.selectedOption);
      submitAnswerBtn.disabled = true;
      nextQuestionBtn.classList.remove('hidden');
    } else {
      const { error: progressError } = await supabase.from('question_progress').upsert({
        user_id: state.profile.id,
        question_id: question.id,
        status: 'not_started',
        attempts_used: nextAttemptNumber,
        last_selected_option: state.selectedOption
      }, { onConflict: 'user_id,question_id' });
      if (progressError) throw progressError;

      showFeedback('error', `Неправильно. Осталась еще 1 попытка.`);
      colorizeOptions(null, state.selectedOption);
    }

    await loadUserProgress();
    await renderCurrentQuestion();
    if (state.profile?.role === 'admin') await loadAdminStats();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Ошибка при сохранении ответа');
  }
}

function colorizeOptions(correctKey, selectedKey) {
  document.querySelectorAll('.option').forEach(el => {
    const key = el.dataset.option;
    el.classList.remove('selected');
    if (correctKey && key === correctKey) el.classList.add('correct');
    if (selectedKey && key === selectedKey && key !== correctKey) el.classList.add('wrong');
  });
}

async function goToNextQuestion() {
  if (state.currentQuestionIndex < state.currentQuestions.length - 1) {
    state.currentQuestionIndex += 1;
    await renderCurrentQuestion();
  } else {
    showToast('Тема завершена');
    showTopicsView();
  }
}

// =========================
// STATS
// =========================
function updateOverallStats(progressRows) {
  const solved = progressRows.filter(x => x.status === 'solved').length;
  const failed = progressRows.filter(x => x.status === 'failed').length;
  const all = solved + failed;

  solvedCount.textContent = solved;
  failedCount.textContent = failed;
  allCount.textContent = all;

  const totalQuestions = Array.from(state.topicProgress.values()).reduce((sum, t) => sum + (t.total || 0), 0);
  progressBadge.textContent = `${all} / ${totalQuestions}`;
}

async function loadAdminStats() {
  if (state.profile?.role !== 'admin') return;

  try {
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, username, real_name, email, role')
      .order('real_name', { ascending: true });

    if (pError) throw pError;

    const { data: progress, error: prError } = await supabase
      .from('question_progress')
      .select('user_id, status');

    if (prError) throw prError;

    const { data: attempts, error: aError } = await supabase
      .from('attempts')
      .select('user_id');

    if (aError) throw aError;

    const statsMap = new Map();

    (profiles || []).forEach(p => {
      if (p.role === 'student') {
        statsMap.set(p.id, {
          name: p.real_name,
          email: p.email,
          solved: 0,
          failed: 0,
          attempts: 0
        });
      }
    });

    (progress || []).forEach(row => {
      const s = statsMap.get(row.user_id);
      if (!s) return;
      if (row.status === 'solved') s.solved += 1;
      if (row.status === 'failed') s.failed += 1;
    });

    (attempts || []).forEach(row => {
      const s = statsMap.get(row.user_id);
      if (!s) return;
      s.attempts += 1;
    });

    const rows = Array.from(statsMap.values()).sort((a, b) => b.solved - a.solved);
    adminTableBody.innerHTML = '';

    if (!rows.length) {
      adminTableBody.innerHTML = `<tr><td colspan="5" class="muted">Пока нет данных</td></tr>`;
      return;
    }

    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${row.solved}</td>
        <td>${row.failed}</td>
        <td>${row.attempts}</td>
      `;
      adminTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Не удалось загрузить admin-статистику');
  }
}

// =========================
// UTILS
// =========================
function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
