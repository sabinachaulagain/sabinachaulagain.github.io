// Lists the repo's own directories through the GitHub API, then opens the PDFs
// and images it finds. Files are served by Pages from the same origin, so a
// plain relative path is all the browser needs.
const OWNER = 'sabinachaulagain';
const REPO = 'sabinachaulagain.github.io';

const tree = document.getElementById('tree');
const content = document.getElementById('content');
const drawer = document.getElementById('drawer');

// Repo files that belong to the site itself, not to the content.
const IGNORE = ['index.html', 'app.js', 'style.css', 'README.md', 'CNAME'];

const PDF = /\.pdf$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const HEIC = /\.(heic|heif)$/i;

const isViewable = name => PDF.test(name) || IMAGE.test(name) || HEIC.test(name);

async function listDir(path) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const items = await res.json();
  return items
    .filter(i => !i.name.startsWith('.') && !IGNORE.includes(i.path))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

// Renders one directory's contents into `ul`. Sub-directories load on click.
async function render(path, ul) {
  ul.innerHTML = '<li class="hint">Loading…</li>';
  let items;
  try {
    items = await listDir(path);
  } catch (err) {
    ul.innerHTML = `<li class="hint">${err.message}</li>`;
    return;
  }

  ul.innerHTML = '';
  if (!items.length) ul.innerHTML = '<li class="hint">Empty</li>';

  for (const item of items) {
    const li = document.createElement('li');

    if (item.type === 'dir') {
      const btn = document.createElement('button');
      btn.className = 'dir';
      btn.textContent = item.name;
      btn.setAttribute('aria-expanded', 'false');
      const sub = document.createElement('ul');
      sub.hidden = true;
      btn.onclick = () => {
        sub.hidden = !sub.hidden;
        btn.setAttribute('aria-expanded', String(!sub.hidden));
        if (!sub.hidden && !sub.dataset.loaded) {
          sub.dataset.loaded = '1';
          render(item.path, sub);
        }
      };
      li.append(btn, sub);
    } else {
      const a = document.createElement('a');
      a.className = PDF.test(item.name) ? 'doc' : isViewable(item.name) ? 'pic' : 'other';
      a.textContent = item.name;
      a.href = isViewable(item.name) ? '#/' + encodePath(item.path) : item.path;
      li.append(a);
    }

    ul.append(li);
  }
}

const encodePath = path => path.split('/').map(encodeURIComponent).join('/');

function stage(node) {
  content.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'stage';
  box.append(node);
  content.append(box);
}

function imageNode(src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  return img;
}

function note(html) {
  content.innerHTML = `<p class="fallback">${html}</p>`;
}

// heic2any is only fetched when a browser actually fails to decode a HEIC.
let heicLib;
function loadHeicDecoder() {
  if (!heicLib) {
    heicLib = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.onload = () => resolve(window.heic2any);
      s.onerror = () => reject(new Error('decoder unavailable'));
      document.head.append(s);
    });
  }
  return heicLib;
}

// Safari decodes HEIC itself; elsewhere convert to JPEG in the browser.
function showHeic(url, path) {
  const img = imageNode(url, path);
  img.onerror = async () => {
    note('Converting HEIC…');
    try {
      const heic2any = await loadHeicDecoder();
      const blob = await fetch(url).then(r => r.blob());
      const jpeg = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 });
      stage(imageNode(URL.createObjectURL(Array.isArray(jpeg) ? jpeg[0] : jpeg), path));
    } catch (err) {
      note(`Cannot display this HEIC (${err.message}). <a href="${url}">Download it</a> instead.`);
    }
  };
  stage(img);
}

function show(path) {
  document.querySelectorAll('#drawer a').forEach(a => a.classList.remove('active'));

  if (!path) {
    content.innerHTML = '';
    return;
  }

  const url = '/' + encodePath(path);

  if (PDF.test(path)) {
    const frame = document.createElement('iframe');
    frame.src = url + '#view=FitH';
    frame.title = path;
    content.innerHTML = '';
    content.append(frame);
  } else if (HEIC.test(path)) {
    showHeic(url, path);
  } else {
    stage(imageNode(url, path));
  }

  document.querySelectorAll('#drawer a').forEach(a => {
    if (decodeURIComponent(a.hash.slice(2)) === path) a.classList.add('active');
  });
}

function route() {
  drawer.classList.remove('open');
  show(decodeURIComponent(location.hash.replace(/^#\/?/, '')));
}

document.getElementById('menu-btn').onclick = () => drawer.classList.toggle('open');
window.addEventListener('hashchange', route);

render('', tree).then(route);
