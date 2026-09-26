/* Channel profile page — pixel-styled YouTube layout with 7 tabs */
import {
  el, t, get, post, put, state, navigate, avatarNode, fmtNum, fmtTime, relTime,
  videoCard, emptyState, loadingBlock, toast, openModal, closeModal, progressBar, statCard, fmtMoney,
} from '../core.js';

let activeTab = 'home';

export async function channelPage(main, params) {
  const handle = params.handle;
  if (!handle) { main.append(emptyState('fa-solid fa-user-slash', t('no_results'))); return; }

  const holder = el('div', { class: 'stack' });
  main.append(holder);
  holder.append(loadingBlock());

  let data;
  try {
    data = await get(`/api/channel/${encodeURIComponent(handle)}`);
  } catch (e) {
    holder.replaceChildren(emptyState('fa-solid fa-user-slash', e.message));
    return;
  }

  const ch = data.channel;
  const st = data.stats;
  holder.replaceChildren();

  /* ------------------------------ banner ---------------------------- */
  const banner = el('div', { class: 'banner' });
  if (ch.banner) banner.append(el('img', { src: ch.banner, alt: ch.full_name }));
  holder.append(banner);

  /* --------------------------- head row ----------------------------- */
  const avatar = el('div', { class: 'channel-avatar' }, [avatarNode(ch.avatar, ch.full_name)]);
  const nameRow = el('h1', { class: 'channel-name' }, [
    el('span', { text: ch.full_name }),
    ch.is_verified ? el('i', { class: 'fa-solid fa-circle-check', title: t('verified_company'), style: 'color:#3b82f6;font-size:19px' }) : null,
    ch.is_company ? el('span', { class: 'badge green', html: '<i class="fa-solid fa-building"></i> ' + t('company_account') }) : null,
  ].filter(Boolean));

  const subLine = el('div', { class: 'channel-sub' }, [
    el('span', { text: `@${ch.handle}` }),
    el('span', { text: `${fmtNum(ch.subscribers)} ${t('subscribers')}` }),
    el('span', { text: `${fmtNum(st.videos)} ${t('videos_count')}` }),
    el('span', { text: ch.profession_name }),
  ]);

  let subBtn;
  if (data.is_owner) {
    subBtn = el('button', {
      class: 'btn primary', onclick: () => editChannelModal(data),
      html: '<i class="fa-solid fa-pen"></i> ' + t('edit_channel'),
    });
  } else {
    const subscribed = data.is_subscribed;
    subBtn = el('button', {
      class: 'btn ' + (subscribed ? 'subscribed' : 'primary'),
      onclick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          const r = await post(`/api/channel/${ch.handle}/subscribe`);
          b.className = 'btn ' + (r.subscribed ? 'subscribed' : 'primary');
          b.replaceChildren(el('i', { class: r.subscribed ? 'fa-solid fa-check' : 'fa-solid fa-bell' }), el('span', { text: r.subscribed ? t('subscribed') : t('subscribe') }));
          subLine.children[1].textContent = `${fmtNum(r.subscribers)} ${t('subscribers')}`;
          toast(r.subscribed ? t('subscribed') : t('subscribed'));
        } catch (err) { toast(err.message, 'error'); }
        b.disabled = false;
      },
    }, [
      el('i', { class: subscribed ? 'fa-solid fa-check' : 'fa-solid fa-bell' }),
      el('span', { text: subscribed ? t('subscribed') : t('subscribe') }),
    ]);
  }

  holder.append(el('div', { class: 'channel-head' }, [
    avatar,
    el('div', { class: 'channel-info' }, [
      nameRow,
      subLine,
      ch.bio ? el('p', { class: 'muted', style: 'margin:4px 0 0', text: ch.bio }) : null,
      el('div', { class: 'channel-actions', style: 'margin-top:10px' }, [
        subBtn,
        el('button', {
          class: 'btn', onclick: () => shareChannel(ch.handle),
          html: '<i class="fa-solid fa-share"></i> ' + t('share'),
        }),
        data.monetization.eligible
          ? el('span', { class: 'badge green', html: '<i class="fa-solid fa-circle-check"></i> ' + t('monetization_eligible') })
          : el('span', { class: 'badge grey', html: '<i class="fa-solid fa-hourglass-half"></i> ' + t('not_eligible') }),
      ].filter(Boolean)),
    ]),
  ].filter(Boolean)));

  /* ------------------------------ tabs ------------------------------ */
  const TABS = [
    ['home', t('home'), 'fa-solid fa-house'],
    ['videos', t('videos'), 'fa-solid fa-clapperboard'],
    ['shorts', t('shorts'), 'fa-solid fa-bolt'],
    ['live', t('live'), 'fa-solid fa-tower-broadcast'],
    ['playlists', t('playlists'), 'fa-solid fa-list'],
    ['community', t('community'), 'fa-solid fa-comments'],
    ['analytics', t('analytics'), 'fa-solid fa-chart-line'],
  ];
  const tabBar = el('div', { class: 'tabs' });
  const panel = el('div', { style: 'margin-top:18px' });
  TABS.forEach(([id, label]) => {
    tabBar.append(el('button', {
      class: 'tab' + (activeTab === id ? ' active' : ''),
      dataset: { tab: id },
      onclick: () => { activeTab = id; renderTab(); },
    }, [el('span', { text: label })]));
  });
  holder.append(tabBar, panel);

  async function renderTab() {
    tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
    panel.replaceChildren(loadingBlock());
    switch (activeTab) {
      case 'home': return renderHome();
      case 'videos': return renderVideos();
      case 'shorts': return renderShorts();
      case 'live': return renderLive();
      case 'playlists': return renderPlaylists();
      case 'community': return renderCommunity();
      case 'analytics': return renderAnalytics();
    }
  }

  function renderHome() {
    const featured = data.videos.find((v) => v.kind === 'long') || data.videos[0];
    const nodes = [];
    if (featured) {
      nodes.push(el('div', { class: 'card' }, [
        el('h3', { class: 'section-title', text: t('recommended') }),
        videoCard(Object.assign({}, featured, { channel_name: ch.full_name, channel_handle: ch.handle, channel_avatar: ch.avatar, channel_verified: ch.is_verified })),
      ]));
    }
    const rest = data.videos.slice(0, 9);
    nodes.push(el('div', { class: 'section-title', text: t('videos') }));
    nodes.push(rest.length
      ? el('div', { class: 'grid videos' }, rest.map((v) => videoCard(withChannel(v))))
      : emptyState('fa-solid fa-video', t('no_videos')));
    panel.replaceChildren(...nodes);
  }

  function renderVideos() {
    const list = data.videos.filter((v) => v.kind === 'long');
    panel.replaceChildren(list.length
      ? el('div', { class: 'grid videos' }, list.map((v) => videoCard(withChannel(v))))
      : emptyState('fa-solid fa-clapperboard', t('no_videos')));
  }

  function renderShorts() {
    const list = data.videos.filter((v) => v.kind === 'short');
    if (!list.length) { panel.replaceChildren(emptyState('fa-solid fa-bolt', t('no_shorts'))); return; }
    panel.replaceChildren(el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr))' },
      list.map((v) => el('div', {
        class: 'video-card', style: 'cursor:pointer', onclick: () => navigate('shorts'),
      }, [
        el('div', { class: 'thumb', style: 'aspect-ratio:9/16' }, [
          v.thumbnail ? el('img', { src: v.thumbnail, alt: v.title }) : el('div', { style: 'display:grid;place-items:center;height:100%;color:var(--text-dim)', html: '<i class="fa-solid fa-bolt"></i>' }),
          el('span', { class: 'dur', text: `${fmtNum(v.views)} ${t('views')}` }),
        ]),
        el('b', { style: 'font-size:13px', text: v.title }),
      ]))));
  }

  function renderLive() {
    const list = data.videos.filter((v) => v.is_live);
    panel.replaceChildren(list.length
      ? el('div', { class: 'grid videos' }, list.map((v) => videoCard(withChannel(v))))
      : emptyState('fa-solid fa-satellite-dish', t('no_live')));
  }

  function renderPlaylists() {
    if (!data.playlists.length) { panel.replaceChildren(emptyState('fa-solid fa-list', t('no_results'))); return; }
    panel.replaceChildren(el('div', { class: 'grid two' }, data.playlists.map((p) => el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('b', { text: p.title }),
        el('i', { class: 'fa-solid fa-list muted' }),
      ]),
      el('div', { class: 'dim', style: 'margin-top:6px', text: relTime(p.created_at) }),
    ]))));
  }

  function renderCommunity() {
    panel.replaceChildren(el('div', { class: 'card' }, [
      el('h3', { class: 'section-title', text: t('community') }),
      el('p', { class: 'muted', text: `${ch.full_name} • ${ch.profession_name}` }),
      el('div', { style: 'margin-top:12px' }, [
        el('button', {
          class: 'btn success', onclick: () => navigate(`community/${roomSlugFor(ch)}`),
          html: '<i class="fa-solid fa-comments"></i> ' + t('general_chat'),
        }),
      ]),
    ]));
  }

  function renderAnalytics() {
    if (!data.is_owner) {
      panel.replaceChildren(emptyState('fa-solid fa-lock', t('login_required')));
      return;
    }
    panel.replaceChildren(el('div', { class: 'stack' }, [
      el('div', { class: 'grid stats' }, [
        statCard(t('views'), fmtNum(st.views), null, 'money'),
        statCard(t('watch_hours'), fmtNum(st.watch_hours), null, 'green'),
        statCard(t('subscribers'), fmtNum(ch.subscribers)),
        statCard(t('shorts'), fmtNum(st.shorts_count), null, 'red'),
      ]),
      el('div', { class: 'card' }, [
        el('h3', { class: 'section-title', text: t('eligibility') }),
        el('p', { class: 'muted', text: t('monetization_rules') }),
        el('div', { class: 'stack', style: 'margin-top:14px' }, [
          progRow(t('subscribers'), ch.subscribers, 1000),
          progRow(t('watch_hours'), st.watch_hours, 4000),
          progRow(t('views') + ' (Shorts)', st.short_views, 10_000_000),
        ]),
      ]),
      el('div', { class: 'card' }, [
        el('h3', { class: 'section-title', text: t('revenue_split') }),
        splitBar(55),
        el('p', { class: 'dim', style: 'margin-top:10px', text: t('long_share') + ' · ' + t('short_share') }),
      ]),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn success', onclick: () => navigate('studio'), html: '<i class="fa-solid fa-chart-line"></i> ' + t('studio') }),
        el('button', { class: 'btn', onclick: () => navigate('wallet'), html: '<i class="fa-solid fa-wallet"></i> ' + t('wallet') }),
      ]),
    ]));
  }

  await renderTab();
}

function withChannel(ch) {
  return Object.assign({ channel_name: ch.full_name, channel_handle: ch.handle, channel_avatar: ch.avatar, channel_verified: ch.is_verified }, ch);
}

function roomSlugFor(ch) {
  if (!ch.profession_name) return 'general';
  return 'general';
}

function progRow(label, current, target) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return el('div', {}, [
    el('div', { class: 'row between' }, [
      el('span', { class: 'muted', text: label }),
      el('span', { class: 'dim', text: `${fmtNum(current)} / ${fmtNum(target)} (${pct.toFixed(1)}%)` }),
    ]),
    el('div', { style: 'margin-top:6px' }, [progressBar(current, target, true)]),
  ]);
}

function splitBar(longPct) {
  const creator = el('div', { class: 'creator', style: `flex:${longPct}`, text: `${longPct}%` });
  const platform = el('div', { class: 'platform', style: `flex:${100 - longPct}`, text: `${100 - longPct}%` });
  return el('div', { class: 'split-bar' }, [creator, platform]);
}

async function shareChannel(handle) {
  const url = `${location.origin}/#/channel/${handle}`;
  try {
    if (navigator.share) await navigator.share({ title: 'CraftHub', url });
    else { await navigator.clipboard.writeText(url); toast(t('share_link')); }
  } catch { try { await navigator.clipboard.writeText(url); toast(t('share_link')); } catch { toast(url, 'info'); } }
}

function editChannelModal(data) {
  const ch = data.channel;
  const f = {};
  const countries = state.boot.countries || [];
  const sectors = state.boot.sectors || [];

  const name = el('input', { class: 'input', value: ch.full_name || '' });
  const bio = el('textarea', { class: 'input', rows: 3, value: ch.bio || '' });
  const avatar = el('input', { class: 'input', placeholder: 'https://…', value: ch.avatar || '' });
  const banner = el('input', { class: 'input', placeholder: 'https://…', value: ch.banner || '' });
  const country = el('select', { class: 'input' }, countries.map((c) => el('option', { value: c.dial, selected: String(c.dial) === String((ch.country_code || '').replace(/[^0-9-]/g, '')) || (ch.country_name || '').includes(c.name) }, [`${c.flag} ${c.name} (+${c.dial})`])));

  const profSel = el('select', { class: 'input' });
  sectors.forEach((s) => {
    const g = el('optgroup', { label: s.ar });
    s.professions.forEach((p) => g.append(el('option', { value: p.id, selected: p.id === ch.profession_id }, [`${p.ar} | ${p.en}`])));
    profSel.append(g);
  });

  const isCompany = el('input', { type: 'checkbox', checked: !!ch.is_company });
  const taxId = el('input', { class: 'input', placeholder: t('tax_id'), value: '' });

  const body = el('div', { class: 'stack' }, [
    el('div', { class: 'form-grid' }, [
      el('div', { class: 'field' }, [el('label', { text: t('full_name') }), name]),
      el('div', { class: 'field' }, [el('label', { text: t('profession') }), profSel]),
    ]),
    el('div', { class: 'form-grid' }, [
      el('div', { class: 'field' }, [el('label', { text: t('country') }), country]),
      el('div', { class: 'field' }, [el('label', { text: t('avatar') }), avatar]),
    ]),
    el('div', { class: 'field' }, [el('label', { text: t('thumbnail') }), banner]),
    el('div', { class: 'field' }, [el('label', { text: t('description') }), bio]),
    el('label', { class: 'row', style: 'gap:10px' }, [isCompany, el('span', { text: t('company_account') })]),
    el('div', { class: 'field' }, [el('label', { text: t('tax_id') }), taxId, el('div', { class: 'hint', text: t('verified_company_req') })]),
  ]);

  const save = el('button', {
    class: 'btn success', html: '<i class="fa-solid fa-floppy-disk"></i> ' + t('save_changes'),
    onclick: async () => {
      save.disabled = true;
      try {
        await put('/api/me/channel', {
          full_name: name.value.trim(),
          bio: bio.value,
          avatar: avatar.value.trim(),
          banner: banner.value.trim(),
          dial: country.value,
          profession_id: profSel.value,
          is_company: isCompany.checked,
          tax_id: taxId.value.trim() || undefined,
        });
        const me = await get('/api/auth/me');
        state.user = me.user;
        toast(t('save_changes'));
        closeModal();
        window.__rerender && window.__rerender();
      } catch (e) { toast(e.message, 'error'); }
      save.disabled = false;
    },
  });

  openModal({
    title: t('edit_channel'), body, wide: true,
    footer: [el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }), save],
  });
}
