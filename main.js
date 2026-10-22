document.documentElement.classList.add('js');

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const mobileQuery = window.matchMedia('(max-width: 680px)');

function closeMenu(restoreFocus = false) {
  navigation.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', '打开导航菜单');
  if (restoreFocus) menuToggle.focus();
}

function syncMenu() {
  const focused = document.activeElement;
  closeMenu();
  menuToggle.hidden = !mobileQuery.matches;
  if (mobileQuery.matches && navigation.contains(focused)) menuToggle.focus();
  if (!mobileQuery.matches && focused === menuToggle) navigation.querySelector('a').focus();
}

syncMenu();
mobileQuery.addEventListener('change', syncMenu);
menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  navigation.classList.toggle('is-open', !expanded);
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  menuToggle.setAttribute('aria-label', expanded ? '打开导航菜单' : '关闭导航菜单');
});
navigation.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  const returnFocus = mobileQuery.matches && navigation.contains(document.activeElement);
  closeMenu(returnFocus);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.site-header')) closeMenu();
});
document.addEventListener('focusin', (event) => {
  if (!event.target.closest('.site-header')) closeMenu();
});

const range = document.querySelector('#comparison-range');
const comparison = document.querySelector('#comparison-stage');
const comparisonButtons = [...document.querySelectorAll('[data-compare]')];
document.querySelector('.comparison-controls').hidden = false;

function updateComparison(value) {
  const percent = Math.max(0, Math.min(100, Number(value)));
  range.value = String(percent);
  comparison.style.setProperty('--split', `${percent}%`);
  range.setAttribute('aria-valuetext', `显示 ${percent}% 设计稿`);
  comparisonButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.compare) === percent)));
  comparison.querySelector('.label-design').hidden = percent === 0;
  comparison.querySelector('.label-implementation').hidden = percent === 100;
  comparison.querySelector('.comparison-line').hidden = percent === 0 || percent === 100;
}

range.addEventListener('input', () => updateComparison(range.value));
comparisonButtons.forEach(button => button.addEventListener('click', () => updateComparison(button.dataset.compare)));
updateComparison(range.value);

const platformButtons = [...document.querySelectorAll('[data-platform]')];
const installationPanels = [...document.querySelectorAll('.installation-panel')];
document.querySelector('.platform-switch').hidden = false;

function selectPlatform(platform) {
  if (!['mac', 'intel', 'windows'].includes(platform)) return;
  platformButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.platform === platform)));
  installationPanels.forEach(panel => { panel.hidden = panel.id !== `install-${platform}`; });
}

platformButtons.forEach(button => button.addEventListener('click', () => selectPlatform(button.dataset.platform)));
document.querySelectorAll('[data-install]').forEach(link => link.addEventListener('click', () => selectPlatform(link.dataset.install)));
selectPlatform('mac');
