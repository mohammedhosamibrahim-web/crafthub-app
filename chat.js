/* Community chat — WhatsApp-style engine with media, replies, admin controls */
import {
  el, t, get, post, put, del, state, navigate, avatarNode, fmtNum, relTime, toast,
  emptyState, loadingBlock, openCtx, openModal, closeModal, EMOJIS, LS, esc,
} from '../core.js';

let pollTimer = null;
let currentRooms = [];

export async function communityPage(main, params) {
  main.style.padding = '0';
  const shell = el('div', { class: 'chat-shell' });
  main.append(shell);

  const roomsPane = el('div', { class: 'chat-rooms', id: 'chat-rooms' });
  const mainPane = el('div', { class: 'chat-main' });
  shell.append(roomsPane, mainPane);

  roomsPane.append(el('div', { class: 'chat-rooms-head' }, [
    el('h3', { style: 'margin:0 0 10px;font-size:16px', text: t('community') }),
    el('input', {
      class: 'input', placeholder: t('search') + '…', id: 'room-search',
      oninput: (e) => paintRooms(e.target.value.trim().toLowerCase()),
    }),
  ]));
  const roomList = el('div', { id: 'room-list' });
  roomsPane.append(roomList);

  try {
    const data = await get('/api/chat/rooms');
    currentRooms = data.rooms;
  } catch (e) {
    roomList.append(emptyState('fa-solid fa-triangle-exclamation', e.message));
    return;
  }

  function paintRooms(filter) {
    roomList.replaceChildren();
    const list = currentRooms.filter((r) => !filter || (r.name || '').toLowerCase().includes(filter));
    if (!list.length) { roomList.append(el('div', { class: 'dim', style: 'padding:16px', text: t('no_results') })); return; }
    list.forEach((r) => {
      const active = params.slug === r.slug;
      roomList.append(el('button', {
        class: 'room-item' + (active ? ' active' : '') + (r.can_enter ? '' : ' locked'),
        onclick: () => navigate(`community/${r.slug}`),
      }, [
        el('div', { class: 'room-ico' }, [
          el('i', { class: r.profession_id === 'general' ? 'fa-solid fa-globe' : (r.can_enter ? 'fa-solid fa-users' : 'fa-solid fa-lock') }),
        ]),
        el('div', { class: 'room-meta' }, [
          el('b', { text: r.name }),
          el('small', { text: `${fmtNum(r.member_count)} ${t('member')}${r.is_paused ? ' • ' + t('suspend') : ''}` }),
        ]),
        r.joined ? el('span', { class: 'badge green', text: t('joined') }) : null,
      ].filter(Boolean)));
    });
  }
  paintRooms('');

  await openRoom(params.slug || 'general');
}

async function openRoom(slug) {
  const mainPane = document.querySelector('.chat-main');
  if (!mainPane) return;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  mainPane.replaceChildren(loadingBlock());

  let room, members = [];
  try {
    const d = await get(`/api/chat/rooms/${encodeURIComponent(slug)}`);
    room = d.room; members = d.members || [];
  } catch (e) {
    const d = e.data || {};
    mainPane.replaceChildren(el('div', { class: 'empty' }, [
      el('i', { class: 'fa-solid fa-lock' }),
      el('p', { text: d.required_profession ? t('access_denied', { profession: d.required_profession }) : e.message }),
      el('div', { style: 'margin-top:14px' }, [el('button', { class: 'btn', text: t('general_chat'), onclick: () => navigate('community/general') })]),
    ]));
    return;
  }

  state.chat.slug = slug;
  state.chat.room = room;
  state.chat.messages = [];
  state.chat.lastId = 0;
  state.chat.pendingReply = null;

  const isStaff = state.user && (state.user.role === 'admin' || state.user.role === 'moderator');
  const isAdmin = state.user && state.user.role === 'admin';
  const muted = !!state.mutedRooms[room.id];

  /* ----------------------------- header ----------------------------- */
  const head = el('div', { class: 'chat-head' }, [
    el('button', { class: 'menu-btn hidden', id: 'chat-back', onclick: () => navigate('community/general'), html: '<i class="fa-solid fa-arrow-right"></i>' }),
    el('div', { class: 'room-ico' }, [el('i', { class: 'fa-solid fa-users' })]),
    el('div', { class: 'grow' }, [
      el('b', { text: room.name }),
      el('small', {}, [
        el('i', { class: 'fa-solid fa-circle', style: 'font-size:7px' }),
        el('span', { text: room.is_paused ? t('suspend') : `${members.length} ${t('member')}` }),
      ]),
    ]),
    el('button', {
      class: 'menu-btn', 'aria-label': 'menu',
      onclick: (e) => roomMenu(e, room, members, isStaff, isAdmin, muted),
      html: '<i class="fa-solid fa-ellipsis-vertical"></i>',
    }),
  ]);
  mainPane.append(head);

  if (room.is_paused) {
    mainPane.append(el('div', { class: 'badge red', style: 'margin:10px 16px;display:inline-flex', html: '<i class="fa-solid fa-triangle-exclamation"></i> ' + (room.paused_reason || t('suspend')) }));
  }

  /* ----------------------------- body ------------------------------- */
  const body = el('div', { class: 'chat-body', id: 'chat-body' });
  mainPane.append(body);

  /* --------------------------- composer ----------------------------- */
  const textarea = el('textarea', {
    rows: 1, placeholder: t('type_message') + '…', id: 'chat-input',
    oninput: (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; },
    onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } },
  });

  const replyBar = el('div', { id: 'reply-bar', class: 'hidden', style: 'padding:6px 16px;border-top:1px solid var(--border);background:var(--bg)' });

  const emojiPanel = el('div', { class: 'emoji-panel hidden', id: 'emoji-panel' });
  EMOJIS.forEach((em) => emojiPanel.append(el('button', { type: 'button', text: em, onclick: () => { textarea.value += em; textarea.focus(); } })));

  const composer = el('div', { class: 'chat-composer' }, [
    el('button', { class: 'menu-btn', title: t('emoji'), onclick: () => emojiPanel.classList.toggle('hidden'), html: '<i class="fa-regular fa-face-smile"></i>' }),
    el('button', { class: 'menu-btn', title: t('attach'), onclick: () => attachMenu(), html: '<i class="fa-solid fa-paperclip"></i>' }),
    el('div', { class: 'composer-box' }, [textarea]),
    el('button', { class: 'menu-btn', title: t('voice_note'), onclick: () => toast(t('voice_note') + ' — ' + t('coming_soon'), 'info'), html: '<i class="fa-solid fa-microphone"></i>' }),
    el('button', { class: 'btn primary', style: 'border-radius:50%;width:44px;height:44px;padding:0;justify-content:center', onclick: () => send(), html: '<i class="fa-solid fa-paper-plane"></i>' }),
  ]);

  mainPane.append(replyBar, emojiPanel, composer);

  /* ------------------------------ send ------------------------------ */
  async function send() {
    const text = textarea.value.trim();
    if (!text && !state.chat.attachment) return;
    const payload = { type: 'text', body: text };
    if (state.chat.attachment) Object.assign(payload, state.chat.attachment);
    if (state.chat.pendingReply) payload.reply_to = state.chat.pendingReply.id;
    try {
      const r = await post(`/api/chat/rooms/${encodeURIComponent(slug)}/messages`, payload);
      textarea.value = '';
      textarea.style.height = 'auto';
      clearReply();
      state.chat.attachment = null;
      if (r.message) { appendMessage(r.message); state.chat.lastId = r.message.id; }
    } catch (e) { toast(e.message, 'error'); }
  }

  function setReply(msg) {
    state.chat.pendingReply = msg;
    replyBar.replaceChildren(el('div', { class: 'row between' }, [
      el('div', { style: 'min-width:0' }, [
        el('b', { style: 'font-size:13px;color:var(--accent-green)', text: `${t('reply')}: ${msg.full_name}` }),
        el('div', { class: 'dim', text: (msg.body || '').slice(0, 80) }),
      ]),
      el('button', { class: 'menu-btn', onclick: clearReply, html: '<i class="fa-solid fa-xmark"></i>' }),
    ]));
    replyBar.classList.remove('hidden');
  }
  function clearReply() {
    state.chat.pendingReply = null;
    replyBar.classList.add('hidden');
    replyBar.replaceChildren();
  }

  function attachMenu() {
    openCtx(window.innerWidth - 240, window.innerHeight - 220, [
      { head: t('attach') },
      { label: t('sticker'), icon: 'fa-solid fa-face-grin-stars', onClick: () => pickSticker() },
      { label: 'PDF / ' + t('description'), icon: 'fa-solid fa-file-pdf', onClick: () => pickFile() },
      { label: 'صورة', icon: 'fa-solid fa-image', onClick: () => pickMedia('image') },
      { label: 'فيديو', icon: 'fa-solid fa-video', onClick: () => pickMedia('video') },
    ]);
  }

  function pickSticker() {
    const panel = el('div', { style: 'display:grid;grid-template-columns:repeat(6,1fr);gap:8px' });
    EMOJIS.slice(0, 60).forEach((em) => panel.append(el('button', {
      class: 'btn', style: 'font-size:30px;padding:6px', text: em,
      onclick: async () => {
        closeModal();
        try {
          const r = await post(`/api/chat/rooms/${encodeURIComponent(slug)}/messages`, { type: 'sticker', body: em });
          if (r.message) { appendMessage(r.message); state.chat.lastId = r.message.id; }
        } catch (e) { toast(e.message, 'error'); }
      },
    })));
    openModal({ title: t('sticker'), body: panel });
  }

  function pickFile() {
    const input = el('input', { type: 'file', class: 'input' });
    const fileName = el('input', { class: 'input', placeholder: t('file_name') || 'file.pdf' });
    const body = el('div', { class: 'stack' }, [
      el('div', { class: 'field' }, [el('label', { text: t('attach') }), input]),
      el('div', { class: 'field' }, [el('label', { text: t('title') }), fileName]),
      el('div', { class: 'hint', text: t('coming_soon') + ': ' + t('attach') }),
    ]);
    openModal({
      title: t('attach'), body,
      footer: [
        el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
        el('button', {
          class: 'btn success', text: t('send'),
          onclick: async () => {
            const f = input.files && input.files[0];
            const b = { type: 'file', file_name: f ? f.name : (fileName.value || 'document.pdf'), body: '' };
            b.media_url = f ? URL.createObjectURL(f) : '';
            closeModal();
            try {
              const r = await post(`/api/chat/rooms/${encodeURIComponent(slug)}/messages`, b);
              if (r.message) { appendMessage(r.message); state.chat.lastId = r.message.id; }
            } catch (e) { toast(e.message, 'error'); }
          },
        }),
      ],
    });
  }

  function pickMedia(kind) {
    const url = el('input', { class: 'input', placeholder: 'https://…' });
    const input = el('input', { type: 'file', accept: kind + '/*', class: 'input' });
    openModal({
      title: kind === 'image' ? 'صورة' : 'فيديو',
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { text: t('source_url') }), url]),
        el('div', { class: 'field' }, [el('label', { text: t('attach') }), input]),
      ]),
      footer: [
        el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
        el('button', {
          class: 'btn success', text: t('send'),
          onclick: async () => {
            const f = input.files && input.files[0];
            const media_url = f ? URL.createObjectURL(f) : url.value.trim();
            const b = { type: kind, media_url, body: '' };
            closeModal();
            try {
              const r = await post(`/api/chat/rooms/${encodeURIComponent(slug)}/messages`, b);
              if (r.message) { appendMessage(r.message); state.chat.lastId = r.message.id; }
            } catch (e) { toast(e.message, 'error'); }
          },
        }),
      ],
    });
  }

  /* --------------------------- message view ------------------------- */
  function messageNode(m) {
    const mine = state.user && m.user_id === state.user.id;
    const logicalDelete = m.deleted_for_all;

    const content = [];
    if (logicalDelete) {
      content.push(el('div', { class: 'body-text', html: '<i class="fa-solid fa-ban"></i> ' + (mine ? t('delete_for_all') : ''), style: 'color:var(--text-dim);font-style:italic' }));
    } else {
      if (m.reply_body) {
        content.push(el('div', { class: 'quote' }, [
          el('b', { text: (m.reply_name || '') + ': ' }),
          el('span', { text: (m.reply_body || '').slice(0, 90) }),
        ]));
      }
      if (!mine) content.push(el('div', { class: 'who' }, [
        el('span', { text: m.full_name }),
        m.is_verified ? el('i', { class: 'fa-solid fa-circle-check', style: 'font-size:11px' }) : null,
      ].filter(Boolean)));

      if (m.type === 'sticker') content.push(el('div', { class: 'sticker', text: m.body || '🙂' }));
      else if (m.type === 'image' && m.media_url) content.push(el('img', { class: 'media', src: m.media_url, alt: '' }));
      else if (m.type === 'video' && m.media_url) content.push(el('video', { class: 'media', src: m.media_url, controls: true }));
      else if (m.type === 'audio') {
        content.push(el('div', { class: 'voice' }, [
          el('button', { class: 'menu-btn', html: '<i class="fa-solid fa-play"></i>', onclick: (e) => e.stopPropagation() }),
          el('div', { class: 'wave' }, Array.from({ length: 22 }, () => el('i', { style: `height:${8 + Math.round(Math.random() * 18)}px` }))),
        ]));
      } else if (m.type === 'file') {
        content.push(el('a', { class: 'file-chip', href: m.media_url || '#', target: '_blank', rel: 'noopener' }, [
          el('i', { class: 'fa-solid fa-file-pdf', style: 'color:var(--accent-red)' }),
          el('span', { text: m.file_name || 'document' }),
        ]));
      } else if (m.body) {
        content.push(el('div', { class: 'body-text', text: m.body }));
      }
    }
    content.push(el('div', { class: 'body-ts', text: relTime(m.created_at) + (mine ? ' ✓' : '') }));

    const bubble = el('div', { class: 'bubble' + (mine ? ' mine' : '') + (logicalDelete ? ' deleted' : '') }, content);

    bubble.addEventListener('contextmenu', (e) => { e.preventDefault(); msgMenu(e.clientX, e.clientY, m, mine, isStaff); });
    let pressTimer = null;
    bubble.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      pressTimer = setTimeout(() => msgMenu(touch.clientX, touch.clientY, m, mine, isStaff), 520);
    }, { passive: true });
    bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));

    return el('div', { class: 'msg-row' + (mine ? ' mine' : ''), dataset: { id: m.id } }, [bubble]);
  }

  function msgMenu(x, y, m, mine, staff) {
    const items = [
      { head: t('reply') },
      { label: t('reply'), icon: 'fa-solid fa-reply', onClick: () => setReply(m) },
      { label: t('copy'), icon: 'fa-solid fa-copy', onClick: () => { navigator.clipboard.writeText(m.body || '').then(() => toast(t('copy'))).catch(() => {}); } },
      { sep: true },
      { label: t('delete_for_me'), icon: 'fa-solid fa-eye-slash', onClick: () => deleteMsg(m.id, 'me') },
      (mine || staff) ? { label: t('delete_for_all'), icon: 'fa-solid fa-trash', danger: true, onClick: () => deleteMsg(m.id, 'all') } : null,
      (staff && !mine) ? { label: t('report'), icon: 'fa-solid fa-flag', danger: true, onClick: () => reportMsg(m.id) } : null,
    ].filter(Boolean);
    openCtx(x, y, items);
  }

  async function deleteMsg(id, scope) {
    if (scope === 'me') {
      state.hiddenMsgs[id] = 1;
      localStorage.setItem(LS.hiddenMsgs, JSON.stringify(state.hiddenMsgs));
      body.querySelector(`[data-id="${id}"]`)?.remove();
    }
    try {
      await post(`/api/messages/${id}/delete`, { scope });
      if (scope === 'all') {
        const node = body.querySelector(`[data-id="${id}"] .bubble`);
        if (node) node.classList.add('deleted');
      }
    } catch (e) { toast(e.message, 'error'); }
  }

  async function reportMsg(id) {
    try { await post('/api/admin/reports', { target_type: 'message', target_id: id, reason: 'تقرير من مشرف' }); toast(t('report')); }
    catch (e) { toast(e.message, 'error'); }
  }

  function appendMessage(m) {
    if (!m) return;
    if (state.hiddenMsgs[m.id]) return;
    if (body.querySelector(`[data-id="${m.id}"]`)) return;
    body.append(messageNode(m));
    body.scrollTop = body.scrollHeight;
  }

  /* ------------------------------ load ------------------------------ */
  async function load() {
    try {
      const d = await get(`/api/chat/rooms/${encodeURIComponent(slug)}/messages`);
      for (const m of d.messages) {
        if (m.id <= state.chat.lastId || state.hiddenMsgs[m.id]) continue;
        appendMessage(m);
        state.chat.lastId = Math.max(state.chat.lastId, m.id);
      }
      if (!body.children.length) body.append(el('p', { class: 'dim', style: 'text-align:center', text: t('no_results') }));
    } catch (e) {
      if (e.status === 403) toast(e.message, 'error');
    }
  }

  await load();
  pollTimer = setInterval(load, 4000);
  document.getElementById('chat-back')?.classList.remove('hidden');
}

/* ------------------------------ room menu ---------------------------- */
async function roomMenu(e, room, members, isStaff, isAdmin, muted) {
  const items = [
    { head: room.name },
    {
      label: muted ? t('notifications') : t('mute'), icon: 'fa-solid fa-bell-slash',
      onClick: async () => {
        try {
          const next = !muted;
          await post(`/api/chat/rooms/${encodeURIComponent(room.slug)}/mute`, { muted: next });
          state.mutedRooms[room.id] = next ? 1 : 0;
          localStorage.setItem(LS.mute, JSON.stringify(state.mutedRooms));
          toast(next ? t('mute') : t('notifications'));
        } catch (err) { toast(err.message, 'error'); }
      },
    },
    {
      label: t('delete_for_me') + ' (' + t('all_languages') + ')', icon: 'fa-solid fa-broom',
      onClick: async () => {
        try { await post(`/api/chat/rooms/${encodeURIComponent(room.slug)}/clear`); toast(t('delete_for_me')); navigate(`community/${room.slug}`); }
        catch (err) { toast(err.message, 'error'); }
      },
    },
  ];

  if (isStaff) {
    items.push({ sep: true });
    items.push({ label: t('view_members') + ` (${members.length})`, icon: 'fa-solid fa-users', onClick: () => showMembers(members, room, isStaff) });
    items.push({ label: t('add_member'), icon: 'fa-solid fa-user-plus', onClick: () => addMember(room, isStaff) });
    items.push({ label: t('remove_member'), icon: 'fa-solid fa-user-minus', onClick: () => removeMember(room, members, isStaff) });
  }
  if (isAdmin) {
    items.push({ sep: true });
    items.push({
      label: room.is_paused ? t('resume') : t('pause_chat'),
      icon: room.is_paused ? 'fa-solid fa-play' : 'fa-solid fa-pause',
      danger: !room.is_paused,
      onClick: () => pauseRoom(room),
    });
  }
  openCtx(e.clientX, e.clientY, items);
}

function showMembers(members, room, isStaff) {
  const body = members.length
    ? el('div', { class: 'stack' }, members.map((m) => el('div', { class: 'row between' }, [
        el('div', { class: 'row' }, [
          el('div', { class: 'avatar-btn', style: 'width:34px;height:34px;font-size:12px' }, [avatarNode(m.avatar, m.full_name)]),
          el('div', {}, [
            el('b', { style: 'font-size:14px', text: m.full_name }),
            el('div', { class: 'dim', text: `${m.profession_name} • ${m.role}` }),
          ]),
        ]),
        isStaff ? el('button', {
          class: 'btn sm', text: t('remove_member'),
          onclick: async () => {
            try { await post(`/api/chat/rooms/${encodeURIComponent(room.slug)}/members`, { action: 'remove', user_id: m.id }); toast(t('remove_member')); }
            catch (e) { toast(e.message, 'error'); }
          },
        }) : null,
      ].filter(Boolean))))
    : el('p', { class: 'dim', text: t('no_results') });
  openModal({ title: `${t('members')} — ${room.name}`, body });
}

function addMember(room, isStaff) {
  const idInput = el('input', { class: 'input', type: 'number', placeholder: 'User ID' });
  const searchInput = el('input', { class: 'input', placeholder: t('search') });
  const results = el('div', { class: 'stack' });
  searchInput.addEventListener('input', async () => {
    const q = searchInput.value.trim();
    results.replaceChildren();
    if (q.length < 2) return;
    try {
      const d = await get('/api/channels');
      const list = (d.channels || []).filter((c) => c.full_name.includes(q) || c.handle.includes(q)).slice(0, 10);
      list.forEach((c) => results.append(el('button', {
        class: 'btn block', onclick: async () => {
          try {
            await post(`/api/chat/rooms/${encodeURIComponent(room.slug)}/members`, { action: 'add', user_id: c.id });
            toast(t('add_member')); closeModal();
          } catch (e) { toast(e.message, 'error'); }
        },
      }, [el('span', { text: `${c.full_name} (@${c.handle})` })])));
      if (!list.length) results.append(el('p', { class: 'dim', text: t('no_results') }));
    } catch (e) { toast(e.message, 'error'); }
  });
  openModal({
    title: t('add_member'),
    body: el('div', { class: 'stack' }, [
      el('div', { class: 'field' }, [el('label', { text: t('search') }), searchInput]),
      results,
      el('div', { class: 'field' }, [el('label', { text: 'User ID' }), idInput]),
    ]),
    footer: [
      el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn success', text: t('add_member'),
        onclick: async () => {
          const uid = Number(idInput.value);
          if (!uid) { toast('User ID', 'error'); return; }
          try { await post(`/api/chat/rooms/${encodeURIComponent(room.slug)}/members`, { action: 'add', user_id: uid }); toast(t('add_member')); closeModal(); }
          catch (e) { toast(e.message, 'error'); }
        },
      }),
    ],
  });
}

function removeMember(room, members, isStaff) {
  const options = members.map((m) => el('option', { value: m.id }, [`${m.full_name} (@${m.handle})`]));
  const sel = el('select', { class: 'input' }, options);
  openModal({
    title: t('remove_member'),
    body: el('div', { class: 'field' }, [el('label', { text: t('members') }), sel]),
    footer: [
      el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn primary', text: t('remove_member'),
        onclick: async () => {
          try { await post(`/api/chat/rooms/${encodeURIComponent(room.slug)}/members`, { action: 'remove', user_id: Number(sel.value) }); toast(t('remove_member')); closeModal(); }
          catch (e) { toast(e.message, 'error'); }
        },
      }),
    ],
  });
}

function pauseRoom(room) {
  const reason = el('input', { class: 'input', placeholder: t('pause_reason'), value: room.paused_reason || '' });
  openModal({
    title: room.is_paused ? t('resume') : t('pause_chat'),
    body: el('div', { class: 'field' }, [el('label', { text: t('pause_reason') }), reason]),
    footer: [
      el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn primary', text: room.is_paused ? t('resume') : t('suspend'),
        onclick: async () => {
          try {
            await post(`/api/chat/rooms/${encodeURIComponent(room.slug)}/pause`, { paused: !room.is_paused, reason: reason.value });
            toast(room.is_paused ? t('resume') : t('suspend'));
            closeModal();
            window.__rerender && window.__rerender();
          } catch (e) { toast(e.message, 'error'); }
        },
      }),
    ],
  });
}

export function stopChatPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
