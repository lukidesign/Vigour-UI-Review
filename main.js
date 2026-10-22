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

const viewButtons = [...document.querySelectorAll('[data-workbench-view]')];
const viewPanels = [...document.querySelectorAll('.workbench-view')];
const viewName = document.querySelector('#workbench-view-name');
const originalImageLink = document.querySelector('#workbench-original');

function selectWorkbenchView(view) {
  const panel = viewPanels.find(item => item.id === `workbench-view-${view}`);
  if (!panel) return;
  viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workbenchView === view)));
  viewPanels.forEach(item => { item.hidden = item !== panel; });
  viewName.textContent = panel.dataset.viewName;
  originalImageLink.href = panel.querySelector('a').href;
  originalImageLink.setAttribute('aria-label', `查看${panel.dataset.viewName}原图，在新标签页打开`);
}

viewButtons.forEach(button => button.addEventListener('click', () => selectWorkbenchView(button.dataset.workbenchView)));
document.querySelector('.view-switch').hidden = false;
selectWorkbenchView('annotation');
