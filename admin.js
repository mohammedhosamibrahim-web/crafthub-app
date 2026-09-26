/* Admin & Moderator control panel */
import {
  el, t, get, post, put, state, navigate, fmtNum, fmtMoney, emptyState, loadingBlock,
  statCard, openModal, closeModal, toast, avatarNode, relTime,
} from '../core.js';

let activeTab = 'overview';

export async function adminPage(main) {
  if (!state.user || (state.user.role !== 'admin' && state.user.role !== 'moderator')) {
    main.append(emptyState('fa-solid fa-shield-halved', t('login_required')));
    return;
  }
  const isAdmin = state.user.role === 'admin';

  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-shield-halved', style: 'color:var(--accent-red)' }),
    el('span', { text: t('admin') }),
    el('span', { class: 'badge red', text: state.user.role }),
  ]));

  const holder = el('div', { class: 'stack' });
  main.append(holder);
  holder.append(loadingBlock());

  let data;
  try { data = await get('/api/admin/overview'); }
  catch (e) { holder.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message)); return; }

  const c = data.counts;
  holder.replaceChildren();

  holder.append(el('div', { class: 'grid stats' }, [
    statCard(t('users'), fmtNum(c.users)),
    statCard(t('rooms'), fmtNum(c.rooms)),
    statCard(t('messages_count'), fmtNum(c.messages)),
    statCard(t('verified_companies'), fmtNum(c.verified_companies), null, 'green'),
    statCard(t('platform_revenue'), fmtMoney(c.platform_revenue), null, 'red'),
    statCard(t('creator_payouts'), fmtMoney(c.creator_payouts), null, 'green'),
    statCard(t('pending_withdrawals'), fmtNum(c.pending_withdrawals), null, 'red'),
  ]));

  if (isAdmin) {
    holder.append(el('div', { class: 'card' }, [
      el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-bullhorn', style: 'color:var(--accent-red)' }), el('span', { text: t('broadcast') })]),
      el('div', { class: 'row wrap' }, [
        el('button', { class: 'btn primary', onclick: broadcastModal, html: '<i class="fa-solid fa-paper-plane"></i> ' + t('broadcast') }),
        el('button', { class: 'btn', onclick: createRoomModal, html: '<i class="fa-solid fa-plus"></i> ' + t('create_room') }),
      ]),
    ]));
  }

  const TABS = isAdmin
    ? ['overview', 'users', 'rooms', 'withdrawals', 'reports', 'ads', 'bot']
    : ['overview', 'users', 'rooms', 'withdrawals', 'reports'];

  const tabs = el('div', { class: 'tabs' }, [
    mkTab('overview', t('dashboard')),
    mkTab('users', t('users')),
    mkTab('rooms', t('rooms')),
    mkTab('withdrawals', t('withdraw_funds')),
    mkTab('reports', t('handle_reports')),
    isAdmin ? mkTab('ads', t('custom_ads') || 'الإعلانات المخصصة') : null,
    isAdmin ? mkTab('bot', t('mod_bot') || 'بوت الإشراف') : null,
  ].filter(Boolean));
  holder.append(tabs);
  const panel = el('div');
  holder.append(panel);

  function mkTab(id, label) {
    return el('button', {
      class: 'tab' + (activeTab === id ? ' active' : ''),
      onclick: () => { activeTab = id; paint(); },
    }, [el('span', { text: label })]);
  }

  function paint() {
    tabs.querySelectorAll('.tab').forEach((b, i) => {
      b.classList.toggle('active', TABS[i] === activeTab);
    });
    panel.replaceChildren(el('div', { style: 'margin-top:14px' }));
    const box = panel.firstChild;
    if (activeTab === 'overview') box.append(overview());
    else if (activeTab === 'users') box.append(usersTable());
    else if (activeTab === 'rooms') box.append(roomsTable());
    else if (activeTab === 'withdrawals') box.append(withdrawalsTable());
    else if (activeTab === 'ads') box.append(adsPanel());
    else if (activeTab === 'bot') box.append(botPanel());
    else box.append(reportsList());
  }

  function overview() {
    return el('div', { class: 'grid two' }, [
      el('div', { class: 'card' }, [
        el('h4', { text: t('platform_revenue') }),
        el('div', { class: 'v money', style: 'font-size:26px;font-weight:800;color:var(--accent-green)', text: fmtMoney(c.platform_revenue) }),
        el('div', { class: 'split-bar', style: 'margin-top:12px' }, [
          el('div', { class: 'creator', style: 'flex:1', text: fmtMoney(c.creator_payouts) }),
          el('div', { class: 'platform', style: 'flex:1', text: fmtMoney(c.platform_revenue) }),
        ]),
        el('p', { class: 'dim', style: 'margin-top:8px', text: 'Creator payouts vs. platform revenue' }),
      ]),
      el('div', { class: 'card' }, [
        el('h4', { text: t('active') + ' ' + t('rooms') }),
        el('div', { class: 'stack' }, data.rooms.slice(0, 6).map((r) => el('div', { class: 'row between' }, [
          el('span', { text: r.name }),
          r.is_paused ? el('span', { class: 'badge red', text: t('suspend') }) : el('span', { class: 'badge green', text: t('active') }),
        ]))),
      ]),
    ]);
  }

  function usersTable() {
    return el('div', { class: 'card' }, [
      el('table', { class: 'table' }, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: t('full_name') }), el('th', { text: t('profession') }),
          el('th', { text: t('subscribers') }), el('th', { text: t('role') }), el('th', { text: '' }),
        ])]),
        el('tbody', {}, data.users.map((u) => el('tr', {}, [
          el('td', {}, [
            el('div', { class: 'row' }, [
              el('div', { class: 'avatar-btn', style: 'width:30px;height:30px;font-size:11px' }, [avatarNode(u.avatar, u.full_name)]),
              el('div', {}, [
                el('b', { text: u.full_name }),
                el('div', { class: 'dim', text: '@' + u.handle }),
              ]),
            ]),
          ]),
          el('td', { text: u.profession_name }),
          el('td', { text: fmtNum(u.subscribers) }),
          el('td', {}, [
            el('span', { class: 'badge ' + (u.role === 'admin' ? 'red' : u.role === 'moderator' ? 'green' : 'grey'), text: u.role }),
            u.is_verified ? el('i', { class: 'fa-solid fa-circle-check', style: 'color:#3b82f6;margin-inline-start:6px' }) : null,
          ].filter(Boolean)),
          el('td', {}, [
            el('button', {
              class: 'btn sm', html: '<i class="fa-solid fa-ellipsis"></i>',
              onclick: (e) => openCtxUser(e, u),
            }),
          ]),
        ]))),
      ]),
    ]);
  }

  function openCtxUser(e, u) {
    const items = [
      { head: u.full_name },
      { label: t('view_members'), icon: 'fa-solid fa-eye', onClick: () => navigate(`channel/${u.handle}`) },
      { sep: true },
      { label: u.is_verified ? t('remove_role') : t('verified_company'), icon: 'fa-solid fa-certificate', onClick: () => toast('verified') },
      { label: t('make_moderator'), icon: 'fa-solid fa-user-shield', onClick: () => setRole(u.id, 'moderator') },
      ...(isAdmin ? [
        { label: t('make_admin'), icon: 'fa-solid fa-crown', onClick: () => setRole(u.id, 'admin') },
        { label: t('remove_role'), icon: 'fa-solid fa-user', onClick: () => setRole(u.id, 'user') },
      ] : []),
      { sep: true },
      { label: t('ban'), icon: 'fa-solid fa-gavel', danger: true, onClick: () => banModal(u) },
    ];
    import('../core.js').then((m) => m.openCtx(e.clientX, e.clientY, items));
  }

  function roomsTable() {
    return el('div', { class: 'card' }, [
      el('table', { class: 'table' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: t('room_name') }), el('th', { text: t('profession') }), el('th', { text: t('status') }), el('th', { text: '' })])]),
        el('tbody', {}, data.rooms.map((r) => el('tr', {}, [
          el('td', { text: r.name }),
          el('td', { class: 'dim', text: r.profession_id }),
          el('td', {}, [r.is_paused ? el('span', { class: 'badge red', text: t('suspend') }) : el('span', { class: 'badge green', text: t('active') })]),
          el('td', {}, [
            isAdmin ? el('button', {
              class: 'btn sm', text: r.is_paused ? t('resume') : t('suspend'),
              onclick: async () => {
                try {
                  await post(`/api/chat/rooms/${r.slug}/pause`, { paused: !r.is_paused, reason: 'إجراء إداري' });
                  toast(r.is_paused ? t('resume') : t('suspend'));
                  window.__rerender && window.__rerender();
                } catch (e) { toast(e.message, 'error'); }
              },
            }) : null,
          ].filter(Boolean)),
        ]))),
      ]),
    ]);
  }

  function withdrawalsTable() {
    if (!data.withdrawals.length) return el('div', { class: 'card' }, [el('p', { class: 'dim', text: t('no_results') })]);
    return el('div', { class: 'card' }, [
      el('table', { class: 'table' }, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: t('full_name') }), el('th', { text: t('amount') }),
          el('th', { text: t('method') }), el('th', { text: t('status') }), el('th', { text: '' }),
        ])]),
        el('tbody', {}, data.withdrawals.map((w) => el('tr', {}, [
          el('td', { text: w.full_name }),
          el('td', { style: 'font-weight:800', text: fmtMoney(w.amount) }),
          el('td', { text: w.method + ' · ' + w.destination }),
          el('td', {}, [el('span', { class: 'badge ' + (w.status === 'pending' ? 'grey' : w.status === 'rejected' ? 'red' : 'green'), text: t(w.status) || w.status })]),
          el('td', {}, isAdmin ? el('div', { class: 'row' }, [
            w.status === 'pending' ? el('button', { class: 'btn sm success', text: t('approve'), onclick: () => decide(w.id, 'approve') }) : null,
            w.status === 'approved' ? el('button', { class: 'btn sm', text: t('mark_paid'), onclick: () => decide(w.id, 'pay') }) : null,
            w.status !== 'rejected' ? el('button', { class: 'btn sm primary', text: t('reject'), onclick: () => decide(w.id, 'reject') }) : null,
          ].filter(Boolean)) : null),
        ]))),
      ]),
    ]);
  }

  async function decide(id, action) {
    try { await post(`/api/admin/withdrawals/${id}/${action}`); toast(t(action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'mark_paid')); window.__rerender && window.__rerender(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function reportsList() {
    if (!data.reports.length) return el('div', { class: 'card' }, [el('p', { class: 'dim', text: t('no_reports') })]);
    return el('div', { class: 'stack' }, data.reports.map((r) => el('div', { class: 'card row between' }, [
      el('div', {}, [
        el('b', { text: `${r.target_type} #${r.target_id}` }),
        el('div', { class: 'dim', text: `${r.reason || '—'} • ${relTime(r.created_at)} • ${r.reporter_name}` }),
      ]),
      el('div', { class: 'row' }, [
        el('button', {
          class: 'btn sm primary', text: t('delete'),
          onclick: async () => {
            const path = r.target_type === 'comment' ? `/api/admin/moderate/comment/${r.target_id}/remove` : `/api/admin/moderate/message/${r.target_id}/remove`;
            try { await post(path); toast(t('delete')); window.__rerender && window.__rerender(); } catch (e) { toast(e.message, 'error'); }
          },
        }),
        el('button', {
          class: 'btn sm', text: t('done'),
          onclick: async () => { try { await post(`/api/admin/reports/${r.id}/handle`); toast(t('done')); window.__rerender && window.__rerender(); } catch (e) { toast(e.message, 'error'); } },
        }),
      ]),
    ])));
  }

  async function setRole(id, role) {
    try { await post(`/api/admin/users/${id}/role`, { role }); toast(t('role') + ': ' + role); window.__rerender && window.__rerender(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function banModal(u) {
    const reason = el('input', { class: 'input', placeholder: t('reason') });
    const hours = el('input', { class: 'input', type: 'number', value: '24', min: '1' });
    openModal({
      title: `${t('ban')} — ${u.full_name}`,
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { text: t('reason') }), reason]),
        el('div', { class: 'field' }, [el('label', { text: t('hours') }), hours]),
      ]),
      footer: [
        el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
        el('button', {
          class: 'btn primary', text: t('ban'),
          onclick: async () => {
            try { await post(`/api/admin/users/${u.id}/ban`, { reason: reason.value || 'مخالفة', hours: Number(hours.value) }); toast(t('ban')); closeModal(); }
            catch (e) { toast(e.message, 'error'); }
          },
        }),
      ],
    });
  }

  function broadcastModal() {
    const title = el('input', { class: 'input', placeholder: t('title') });
    const body = el('textarea', { class: 'input', rows: 3, placeholder: t('description') });
    openModal({
      title: t('broadcast'),
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { text: t('title') }), title]),
        el('div', { class: 'field' }, [el('label', { text: t('description') }), body]),
      ]),
      footer: [
        el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
        el('button', {
          class: 'btn primary', text: t('broadcast'),
          onclick: async () => {
            if (!title.value.trim()) return toast(t('title'), 'error');
            try { await post('/api/admin/broadcast', { title: title.value, body: body.value }); toast(t('broadcast')); closeModal(); }
            catch (e) { toast(e.message, 'error'); }
          },
        }),
      ],
    });
  }

  function createRoomModal() {
    const name = el('input', { class: 'input', placeholder: t('room_name') });
    const slug = el('input', { class: 'input', placeholder: 'slug-name' });
    const desc = el('input', { class: 'input', placeholder: t('description') });
    const prof = el('input', { class: 'input', placeholder: t('profession') + ' id (or general)', value: 'general' });
    openModal({
      title: t('create_room'),
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { text: t('room_name') }), name]),
        el('div', { class: 'field' }, [el('label', { text: 'Slug' }), slug]),
        el('div', { class: 'field' }, [el('label', { text: t('description') }), desc]),
        el('div', { class: 'field' }, [el('label', { text: t('profession') }), prof]),
      ]),
      footer: [
        el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
        el('button', {
          class: 'btn success', text: t('create'),
          onclick: async () => {
            if (!name.value.trim() || !slug.value.trim()) return toast(t('room_name'), 'error');
            try {
              await post('/api/chat/rooms', { name: name.value, slug: slug.value, description: desc.value, profession_id: prof.value });
              toast(t('create_room')); closeModal();
            } catch (e) { toast(e.message, 'error'); }
          },
        }),
      ],
    });
  }

  /* ---------------------------------------------------------------- *
   * Custom Ads Management
   *
   * AdMob App ID / Banner Ad Units are OPTIONAL — they live under an
   * "optional" disclosure and the app runs perfectly without them by
   * serving the admin's own ad links + banner images.
   * ---------------------------------------------------------------- */
  async function adsPanel() {
    const wrap = el('div', { class: 'stack' });
    wrap.append(loadingBlock());

    let settings;
    try {
      const resp = await get('/api/admin/ads');
      settings = resp.settings || {};
    } catch (e) {
      wrap.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message));
      return wrap;
    }

    const field = (label, key, placeholder, hint) => {
      const input = el('input', {
        class: 'input', placeholder: placeholder || '',
        value: settings[key] || '',
      });
      input.dataset.key = key;
      return el('div', { class: 'field' }, [
        el('label', { text: label }),
        input,
        hint ? el('small', { class: 'dim', text: hint }) : null,
      ].filter(Boolean));
    };

    /* ---- master toggle switch ---- */
    const toggle = el('input', { type: 'checkbox', class: 'switch-input' });
    toggle.checked = !!settings.enabled;
    toggle.id = 'ads-toggle';
    const switchEl = el('label', { class: 'switch', for: 'ads-toggle' }, [toggle, el('span', { class: 'slider' })]);
    const toggleState = el('span', {
      class: 'badge ' + (settings.enabled ? 'green' : 'grey'),
      text: settings.enabled ? t('enabled') || 'مفعّل' : t('disabled') || 'متوقف',
    });
    toggle.addEventListener('change', async () => {
      try {
        const r = await post('/api/admin/ads/toggle', { enabled: toggle.checked });
        toggleState.className = 'badge ' + (r.enabled ? 'green' : 'grey');
        toggleState.textContent = r.enabled ? (t('enabled') || 'مفعّل') : (t('disabled') || 'متوقف');
        toast(t('saved') || 'تم الحفظ');
      } catch (e) { toast(e.message, 'error'); toggle.checked = !toggle.checked; }
    });

    /* ---- every editable field lives here ---- */
    const grid = el('div', { class: 'grid two' }, [
      el('div', { class: 'card' }, [
        el('h4', {}, [el('i', { class: 'fa-brands fa-android', style: 'color:var(--accent-green)' }), el('span', { text: ' Android' })]),
        field('Android Ad Link', 'android_link', 'https://…', 'يُفتح عند الضغط على البانر'),
        field('Android Banner Image', 'android_banner', 'https://…/banner.png', 'صورة البانر'),
      ]),
      el('div', { class: 'card' }, [
        el('h4', {}, [el('i', { class: 'fa-brands fa-apple' }), el('span', { text: ' iOS' })]),
        field('iOS Ad Link', 'ios_link', 'https://…', 'يُفتح عند الضغط على البانر'),
        field('iOS Banner Image', 'ios_banner', 'https://…/banner.png', 'صورة البانر'),
      ]),
      el('div', { class: 'card' }, [
        el('h4', {}, [el('i', { class: 'fa-solid fa-desktop', style: 'color:var(--accent-red)' }), el('span', { text: ' Desktop / Web' })]),
        field('Desktop Ad Link', 'desktop_link', 'https://…'),
        field('Desktop Banner Image', 'desktop_banner', 'https://…/banner.png'),
      ]),
      el('div', { class: 'card tint' }, [
        el('h4', {}, [
          el('i', { class: 'fa-solid fa-key', style: 'color:var(--accent-green)' }),
          el('span', { text: ' AdMob (اختياري)' }),
        ]),
        el('p', { class: 'dim', small: true, text: t('admob_optional') || 'مفاتيح AdMob اختيارية تماماً. إذا تركتها فارغة يعمل التطبيق تلقائياً على روابط الإعلانات المخصصة أعلاه بدون أي أخطاء أو طلب مفاتيح.' }),
        field('AdMob App ID (optional)', 'admob_app_id', 'ca-app-pub-…'),
        field('AdMob Banner Unit (optional)', 'admob_banner_unit', 'ca-app-pub-…/…'),
      ]),
    ]);

    const save = el('button', {
      class: 'btn primary', html: '<i class="fa-solid fa-floppy-disk"></i> ' + (t('save') || 'حفظ'),
      onclick: async () => {
        const body = { enabled: toggle.checked };
        wrap.querySelectorAll('.input[data-key]').forEach((i) => { body[i.dataset.key] = i.value.trim(); });
        try {
          await put('/api/admin/ads', body);
          toast(t('saved') || 'تم الحفظ');
          window.__rerender && window.__rerender();
        } catch (e) { toast(e.message, 'error'); }
      },
    });

    wrap.replaceChildren(
      el('div', { class: 'card row between' }, [
        el('div', {}, [
          el('b', { text: t('ads_enabled') || 'تشغيل الإعلانات' }),
          el('div', { class: 'dim', text: t('ads_hint') || 'تحكم كامل بإعلانات التطبيق — Android / iOS / الويب' }),
        ]),
        el('div', { class: 'row' }, [toggleState, switchEl]),
      ]),
      grid,
      el('div', { class: 'row' }, [save]),
      el('p', { class: 'dim', small: true, text: t('ads_fallback') || 'عند تعطيل الإعلانات أو عدم إدخال أي مفاتيح، لن يظهر أي إعلان ولن يُطلب أي مفتاح.' }),
    );
    return wrap;
  }

  /* ---------------------------------------------------------------- *
   * Auto-Moderation Bot control panel
   * ---------------------------------------------------------------- */
  async function botPanel() {
    const wrap = el('div', { class: 'stack' });
    wrap.append(loadingBlock());
    let data;
    try { data = await get('/api/admin/moderation'); }
    catch (e) { wrap.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message)); return wrap; }

    const st = data.settings;
    const toggle = el('input', { type: 'checkbox', class: 'switch-input', id: 'bot-toggle' });
    toggle.checked = !!st.enabled;
    toggle.addEventListener('change', async () => {
      try { await post('/api/admin/moderation/toggle', { enabled: toggle.checked }); toast(t('saved') || 'تم الحفظ'); }
      catch (e) { toast(e.message, 'error'); toggle.checked = !toggle.checked; }
    });

    const sliders = el('div', { class: 'grid two' });
    const mkRange = (key, label, min, max, val, hint) => {
      const out = el('b', { text: String(val) });
      const r = el('input', { type: 'range', class: 'input', min: String(min), max: String(max), value: String(val) });
      r.addEventListener('input', () => { out.textContent = r.value; });
      r.dataset.key = key;
      return el('div', { class: 'field' }, [
        el('label', {}, [el('span', { text: label + ': ' }), out]),
        r,
        hint ? el('small', { class: 'dim', text: hint }) : null,
      ].filter(Boolean));
    };
    sliders.append(
      mkRange('sensitivity', t('sensitivity') || 'درجة الحساسية', 0, 100, st.sensitivity, '0-39 كتم فقط • 40-79 كتم ثم حظر • 80+ حظر فوري'),
      mkRange('auto_ban_hours', t('auto_ban_hours') || 'ساعات الحظر التلقائي', 0, 720, st.auto_ban_hours, '0 = بدون حظر تلقائي'),
    );

    const flags = el('div', { class: 'row wrap' });
    const mkFlag = (key, label, val) => {
      const i = el('input', { type: 'checkbox', class: 'switch-input' });
      i.checked = !!val; i.dataset.flag = key;
      const lab = el('label', { class: 'switch' }, [i, el('span', { class: 'slider' })]);
      return el('div', { class: 'card row between', style: 'flex:1;min-width:220px' }, [el('b', { text: label }), lab]);
    };
    flags.append(
      mkFlag('block_links', t('block_links') || 'حظر الروابط والإعلانات', st.block_links),
      mkFlag('block_media', t('block_media') || 'حظر الوسائط غير اللائقة', st.block_media),
      mkFlag('mask_offensive', t('mask_offensive') || 'كتم الألفاظ المسيئة', st.mask_offensive),
    );

    const wordIn = el('input', { class: 'input', placeholder: t('add_word') || 'أضف كلمة محظورة…' });
    const wordList = el('div', { class: 'row wrap' });
    data.words.forEach((w) => wordList.append(el('span', { class: 'badge red', style: 'gap:6px' }, [
      el('span', { text: w.word }),
      el('i', {
        class: 'fa-solid fa-xmark', style: 'cursor:pointer',
        onclick: async () => {
          try { await del(`/api/admin/moderation/words/${w.id}`); toast(t('delete')); window.__rerender && window.__rerender(); }
          catch (e) { toast(e.message, 'error'); }
        },
      }),
    ])));

    const save = el('button', {
      class: 'btn primary', html: '<i class="fa-solid fa-floppy-disk"></i> ' + (t('save') || 'حفظ'),
      onclick: async () => {
        const body = {};
        sliders.querySelectorAll('.input[data-key]').forEach((i) => { body[i.dataset.key] = Number(i.value); });
        flags.querySelectorAll('.switch-input[data-flag]').forEach((i) => { body[i.dataset.flag] = i.checked; });
        body.enabled = toggle.checked;
        try { await put('/api/admin/moderation', body); toast(t('saved') || 'تم الحفظ'); }
        catch (e) { toast(e.message, 'error'); }
      },
    });

    const addWord = el('button', {
      class: 'btn success', html: '<i class="fa-solid fa-plus"></i>',
      onclick: async () => {
        if (!wordIn.value.trim()) return;
        try { await post('/api/admin/moderation/words', { word: wordIn.value.trim() }); toast(t('saved')); window.__rerender && window.__rerender(); }
        catch (e) { toast(e.message, 'error'); }
      },
    });

    wrap.replaceChildren(
      el('div', { class: 'card row between' }, [
        el('div', {}, [
          el('b', { text: t('mod_bot') || 'بوت الإشراف الآلي' }),
          el('div', { class: 'dim', text: t('mod_bot_hint') || 'يفحص كل الرسائل والوسائط فور إرسالها ويحذف المسيء تلقائياً' }),
        ]),
        el('label', { class: 'switch' }, [toggle, el('span', { class: 'slider' })]),
      ]),
      el('div', { class: 'grid stats' }, [
        statCard(t('mod_actions') || 'إجراءات', fmtNum(data.stats.actions)),
        statCard(t('mod_blocked') || 'محذوفة', fmtNum(data.stats.blocked), null, 'red'),
        statCard(t('mod_masked') || 'مكتومة', fmtNum(data.stats.masked)),
        statCard(t('mod_bans') || 'حظر تلقائي', fmtNum(data.stats.auto_bans), null, 'green'),
      ]),
      sliders, flags,
      el('div', { class: 'card' }, [
        el('h4', {}, [el('i', { class: 'fa-solid fa-ban', style: 'color:var(--accent-red)' }), el('span', { text: ' ' + (t('blacklist') || 'الكلمات المظلمة والمحظورة') })]),
        el('div', { class: 'row' }, [el('div', { style: 'flex:1' }, [wordIn]), addWord]),
        el('div', { class: 'spacer-4' }),
        wordList,
        el('p', { class: 'dim', small: true, text: `${data.builtin_count} كلمة مدمجة + ${data.words.length} مضافة` }),
      ]),
      el('div', { class: 'row' }, [save]),
      el('div', { class: 'card' }, [
        el('h4', {}, [el('i', { class: 'fa-solid fa-clock-rotate-left' }), el('span', { text: ' ' + (t('mod_log') || 'سجل الإشراف') })]),
        data.recent.length
          ? el('table', { class: 'table' }, [
              el('thead', {}, [el('tr', {}, [el('th', { text: t('action') || 'الإجراء' }), el('th', { text: t('users') }), el('th', { text: t('reason') || 'السبب' }), el('th', { text: '' })])]),
              el('tbody', {}, data.recent.map((r) => el('tr', {}, [
                el('td', {}, [el('span', { class: 'badge ' + (r.action === 'block' || r.action === 'auto_ban' ? 'red' : 'grey'), text: r.action })]),
                el('td', { text: r.full_name || '—' }),
                el('td', { class: 'dim', text: r.matched || r.reason || '—' }),
                el('td', { class: 'dim', text: relTime(r.created_at) }),
              ]))),
            ])
          : el('p', { class: 'dim', text: t('no_results') }),
      ]),
    );
    return wrap;
  }

  paint();
}
