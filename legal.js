/* Legal — terms, privacy and monetization policies */
import { el, t, get, emptyState, loadingBlock, navigate } from '../core.js';

const DOCS = ['terms', 'privacy', 'monetization'];

export async function legalPage(main, params) {
  const doc = params.doc && DOCS.includes(params.doc) ? params.doc : 'terms';

  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-scale-balanced', style: 'color:var(--accent-green)' }),
    el('span', { text: t('terms') }),
  ]));

  const tabBar = el('div', { class: 'tabs' }, [
    mk('terms', t('terms'), 'fa-solid fa-file-contract'),
    mk('privacy', t('privacy'), 'fa-solid fa-user-shield'),
    mk('monetization', t('monetization'), 'fa-solid fa-sack-dollar'),
  ]);
  main.append(tabBar);

  const holder = el('div', { style: 'margin-top:16px' });
  main.append(holder);
  holder.append(loadingBlock());

  function mk(id, label, icon) {
    return el('button', {
      class: 'tab' + (doc === id ? ' active' : ''),
      onclick: () => navigate(`legal?doc=${id}`),
    }, [el('i', { class: icon, style: 'margin-inline-end:8px' }), el('span', { text: label })]);
  }

  try {
    const data = await get('/api/legal');
    const payload = data[doc];
    holder.replaceChildren(el('article', { class: 'card legal-body' }, [
      el('h2', { style: 'margin:0 0 6px', text: payload.title_ar + ' | ' + payload.title_en }),
      el('div', { class: 'dim', text: `${t('last_updated')}: ${payload.updated}` }),
      ...payload.sections.flatMap((s) => [
        el('h4', { text: s.h_ar }),
        el('p', { text: s.p_ar }),
        el('h4', { style: 'opacity:.8;font-size:14px', text: s.h_en }),
        el('p', { style: 'font-size:13.5px', text: s.p_en }),
      ]),
    ]));
  } catch (e) {
    holder.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message));
  }
}
