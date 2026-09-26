/* Settings — theme, 50 languages with auto RTL/LTR, legal links */
import {
  el, t, state, navigate, applyLang, applyTheme, langMeta, toast, get, openModal, closeModal,
} from '../core.js';

export async function settingsPage(main, params) {
  const tab = params.tab && params.tab !== 'undefined' ? params.tab : (params.tab === 'undefined' ? 'general' : (params.tab || 'general'));
  const activeTab = ['general', 'language', 'legal'].includes(tab) ? tab : 'general';

  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-gear' }), el('span', { text: t('settings') }),
  ]));

  const tabs = el('div', { class: 'tabs' }, [
    mkTab('general', t('settings'), 'general'),
    mkTab('language', t('language'), 'language'),
    mkTab('legal', t('terms'), 'legal'),
  ]);
  main.append(tabs);
  const panel = el('div', { style: 'margin-top:18px' });
  main.append(panel);

  function mkTab(id, label, key) {
    return el('button', {
      class: 'tab' + (activeTab === key ? ' active' : ''),
      onclick: () => navigate(`settings?tab=${id}`),
    }, [el('span', { text: label })]);
  }

  if (activeTab === 'general') renderGeneral();
  else if (activeTab === 'language') renderLanguage();
  else renderLegal();

  /* ----------------------------- general ---------------------------- */
  function renderGeneral() {
    panel.replaceChildren(el('div', { class: 'stack' }, [
      el('div', { class: 'card' }, [
        el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-palette', style: 'color:var(--accent-red)' }), el('span', { text: t('theme') })]),
        el('div', { class: 'grid two' }, [
          themeCard('light', t('light'), '#FFFFFF', '#0F172A', 'fa-solid fa-sun'),
          themeCard('dark', t('dark'), '#0F0F0F', '#F8FAFC', 'fa-solid fa-moon'),
        ]),
      ]),
      el('div', { class: 'card' }, [
        el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-shield-halved', style: 'color:var(--accent-green)' }), el('span', { text: t('account') })]),
        state.user
          ? el('div', { class: 'stack' }, [
              infoRow(t('full_name'), state.user.full_name),
              infoRow(t('phone'), state.user.phone),
              infoRow(t('email'), state.user.email),
              infoRow(t('profession'), state.user.profession_name),
              infoRow(t('sector'), state.user.sector_name),
              el('div', { class: 'row' }, [
                el('button', { class: 'btn', onclick: () => navigate(`channel/${state.user.handle}`), html: '<i class="fa-solid fa-circle-user"></i> ' + t('my_channel') }),
                el('button', { class: 'btn primary', onclick: () => window.__logout && window.__logout(), html: '<i class="fa-solid fa-right-from-bracket"></i> ' + t('logout') }),
              ]),
            ])
          : el('div', { class: 'row' }, [
              el('button', { class: 'btn primary', text: t('login'), onclick: () => navigate('login') }),
              el('button', { class: 'btn', text: t('signup'), onclick: () => navigate('signup') }),
            ]),
      ]),
      el('div', { class: 'card' }, [
        el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-scale-balanced' }), el('span', { text: t('settings') })]),
        el('div', { class: 'row wrap' }, [
          el('button', { class: 'btn', onclick: () => navigate('legal?doc=terms'), html: '<i class="fa-solid fa-file-contract"></i> ' + t('terms') }),
          el('button', { class: 'btn', onclick: () => navigate('legal?doc=privacy'), html: '<i class="fa-solid fa-user-shield"></i> ' + t('privacy') }),
          el('button', { class: 'btn', onclick: () => navigate('legal?doc=monetization'), html: '<i class="fa-solid fa-sack-dollar"></i> ' + t('monetization') }),
        ]),
      ]),
    ]));
  }

  function themeCard(id, label, bg, fg, icon) {
    const on = state.theme === id;
    return el('button', {
      class: 'lang-opt' + (on ? ' active' : ''),
      onclick: () => { applyTheme(id); toast(t('theme')); window.__rerender && window.__rerender(); },
      style: 'flex-direction:column;align-items:stretch;gap:10px',
    }, [
      el('div', { class: 'row between' }, [
        el('b', {}, [el('i', { class: icon }), ' ' + label]),
        on ? el('i', { class: 'fa-solid fa-circle-check', style: 'color:var(--accent-green)' }) : null,
      ].filter(Boolean)),
      el('div', { style: `background:${bg};color:${fg};border:1px solid var(--border);border-radius:10px;padding:14px;font-weight:700` }, [
        el('span', { text: 'CraftHub' }),
        el('div', { style: 'height:6px;border-radius:4px;margin-top:8px;background:linear-gradient(90deg,#FF0000,#10B981)' }),
      ]),
    ]);
  }

  function infoRow(k, v) {
    return el('div', { class: 'row between', style: 'padding:8px 0;border-bottom:1px solid var(--border)' }, [
      el('span', { class: 'muted', text: k }),
      el('b', { text: v || '—' }),
    ]);
  }

  /* ---------------------------- language ---------------------------- */
  function renderLanguage() {
    const langs = (state.boot.i18n && state.boot.i18n.languages) || [];
    const search = el('input', { class: 'input', placeholder: t('search') + '…' });
    const grid = el('div', { class: 'lang-grid' });

    function paint(filter) {
      grid.replaceChildren();
      langs
        .filter((l) => !filter || l.native.toLowerCase().includes(filter) || l.name.toLowerCase().includes(filter) || l.code.toLowerCase().includes(filter))
        .forEach((l) => {
          const on = state.lang === l.code;
          grid.append(el('button', {
            class: 'lang-opt' + (on ? ' active' : ''),
            onclick: () => {
              applyLang(l.code);
              toast(`${l.native} • ${l.dir.toUpperCase()}`);
              window.__rerender && window.__rerender();
            },
          }, [
            el('span', {}, [el('b', { text: l.native }), el('div', { class: 'dim', text: l.name })]),
            el('span', { class: 'row', style: 'gap:6px' }, [
              el('small', { text: l.dir.toUpperCase() }),
              on ? el('i', { class: 'fa-solid fa-circle-check', style: 'color:var(--accent-green)' }) : null,
            ].filter(Boolean)),
          ]));
        });
      if (!grid.children.length) grid.append(el('p', { class: 'dim', text: t('no_results') }));
    }
    search.addEventListener('input', () => paint(search.value.trim().toLowerCase()));
    paint('');

    panel.replaceChildren(el('div', { class: 'stack' }, [
      el('div', { class: 'card' }, [
        el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-globe', style: 'color:var(--accent-green)' }), el('span', { text: t('choose_language') })]),
        el('p', { class: 'muted', text: `${langs.length} ${t('all_languages')} • ${t('auto_rtl')}` }),
        el('div', { class: 'row between', style: 'margin:12px 0' }, [
          el('span', { class: 'badge green', text: t('ui_direction') + ': ' + (langMeta(state.lang).dir || 'ltr').toUpperCase() }),
          el('span', { class: 'badge grey', text: langMeta(state.lang).name }),
        ]),
        search,
        el('div', { class: 'spacer-4' }),
        grid,
      ]),
    ]));
  }

  /* ----------------------------- legal ------------------------------ */
  async function renderLegal() {
    panel.replaceChildren(el('div', { class: 'card legal-body' }, [el('p', { class: 'muted', text: t('loading') })]));
    try {
      const data = await get('/api/legal');
      panel.replaceChildren(el('div', { class: 'stack' }, [
        legalBlock(data.terms, 'fa-solid fa-file-contract', t('terms')),
        legalBlock(data.privacy, 'fa-solid fa-user-shield', t('privacy')),
        legalBlock(data.monetization, 'fa-solid fa-sack-dollar', t('monetization')),
      ]));
    } catch (e) {
      panel.replaceChildren(el('div', { class: 'card' }, [el('p', { class: 'muted', text: e.message })]));
    }
  }

  function legalBlock(doc, icon, fallbackTitle) {
    return el('section', { class: 'card legal-body' }, [
      el('h3', { class: 'section-title' }, [el('i', { class: icon }), el('span', { text: doc.title_ar + ' | ' + doc.title_en })]),
      el('div', { class: 'dim', text: `${t('last_updated')}: ${doc.updated}` }),
      ...doc.sections.flatMap((s) => [
        el('h4', { text: s.h_ar + ' — ' + s.h_en }),
        el('p', { text: s.p_ar }),
        el('p', { style: 'margin-top:6px;font-size:13.5px', text: s.p_en }),
      ]),
    ]);
  }
}
