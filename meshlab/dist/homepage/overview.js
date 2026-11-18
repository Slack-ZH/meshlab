(() => {
  const form = document.querySelector('.structure-search');
  const search = document.getElementById('q');
  const filters = document.querySelector('.filters');
  const buttons = [...filters.querySelectorAll('[data-filter]')];
  const results = [...document.querySelectorAll('.result')];
  const status = document.getElementById('match-count');
  const more = document.getElementById('more-results');
  const reset = document.getElementById('reset-filters');
  const empty = document.getElementById('empty-results');
  const section = document.getElementById('structures');
  const pageSize = 12;
  const normalize = value => value.normalize('NFKC').toLowerCase().trim();
  const searchText = new Map(results.map(entry => [
    entry, normalize(entry.textContent + ' ' + entry.dataset.terms)
  ]));
  let category = 'all';
  let limit = pageSize;

  function render() {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    const counts = new Map(buttons.map(button => [button.dataset.filter, 0]));
    let matched = 0;
    for (const entry of results) {
      const group = entry.dataset.group;
      const found = words.every(word => searchText.get(entry).includes(word));
      if (found) {
        counts.set('all', counts.get('all') + 1);
        counts.set(group, counts.get(group) + 1);
      }
      const eligible = found && (category === 'all' || group === category);
      if (eligible) matched++;
      entry.hidden = !eligible || matched > limit;
    }
    for (const button of buttons) {
      const group = button.dataset.filter;
      button.setAttribute('aria-pressed', String(group === category));
      button.querySelector('span').textContent = counts.get(group);
    }
    const query = search.value.trim();
    const filtered = query || category !== 'all';
    status.textContent = (query ? '“' + query + '” · ' : '') +
      (filtered ? '找到 ' : '共 ') + matched + ' 个实验';
    empty.hidden = matched !== 0;
    more.hidden = matched <= limit;
    if (!more.hidden) more.textContent = '显示更多结构（已显示 ' + limit + ' / ' + matched + '）';
    document.getElementById('clear-active').hidden = !filtered || !matched;
  }

  function syncUrl() {
    const url = new URL(location.href);
    const query = search.value.trim();
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    if (category !== 'all') url.searchParams.set('category', category);
    else url.searchParams.delete('category');
    history.replaceState({ ...history.state, catalogLimit: limit }, '', url);
  }
  function apply(query, group) {
    search.value = query;
    category = group;
    limit = pageSize;
    render();
    syncUrl();
  }
  function restore() {
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') || '';
    const group = params.get('category');
    category = buttons.some(button => button.dataset.filter === group) ? group : 'all';
    limit = Math.max(pageSize, Number(history.state?.catalogLimit) || 0);
    render();
  }
  function goToResults() {
    const url = new URL(location.href);
    url.hash = section.id;
    history.replaceState(history.state, '', url);
    section.scrollIntoView({ block: 'start' });
    document.getElementById('catalog-title').focus({ preventScroll: true });
  }
  search.addEventListener('input', event => {
    if (!event.isComposing) apply(search.value, category);
  });
  search.addEventListener('compositionend', () => apply(search.value, category));
  form.addEventListener('submit', event => {
    event.preventDefault();
    apply(search.value, category);
    goToResults();
  });
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (button) apply(search.value, button.dataset.filter);
  });
  document.querySelectorAll('.examples a').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      apply(new URL(link.href).searchParams.get('q') || '', 'all');
      goToResults();
    });
  });
  function clearFilters() {
    apply('', 'all');
    buttons[0].focus({ preventScroll: true });
  }
  reset.addEventListener('click', clearFilters);
  document.getElementById('clear-active').addEventListener('click', clearFilters);
  more.addEventListener('click', () => {
    const before = new Set(results.filter(entry => !entry.hidden));
    limit += pageSize;
    render();
    syncUrl();
    results.find(entry => !entry.hidden && !before.has(entry))?.focus();
  });
  window.addEventListener('popstate', restore);
  filters.hidden = false;
  restore();
})();
