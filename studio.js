/* CraftHub Studio — creator analytics dashboard */
import {
  el, t, get, post, state, navigate, fmtNum, fmtMoney, emptyState, loadingBlock,
  statCard, progressBar, openModal, closeModal, toast, fmtTime, relTime,
} from '../core.js';

export async function studioPage(main) {
  if (!state.user) {
    main.append(emptyState('fa-solid fa-lock', t('login_required')));
    return;
  }
  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-chart-line', style: 'color:var(--accent-red)' }),
    el('span', { text: t('studio') }),
  ]));

  const holder = el('div', { class: 'stack' });
  main.append(holder);
  holder.append(loadingBlock());

  let ch, wallet;
  try {
    [ch, wallet] = await Promise.all([
      get(`/api/channel/${state.user.handle}`),
      get('/api/wallet'),
    ]);
  } catch (e) {
    holder.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message));
    return;
  }

  const st = ch.stats;
  const el0 = ch.monetization;
  holder.replaceChildren();

  holder.append(el('div', { class: 'grid stats' }, [
    statCard(t('views'), fmtNum(st.views), null, 'money'),
    statCard(t('watch_hours'), fmtNum(st.watch_hours), null, 'green'),
    statCard(t('subscribers'), fmtNum(ch.channel.subscribers), null, 'red'),
    statCard(t('earnings'), fmtMoney(wallet.wallet.balance), `lifetime ${fmtMoney(wallet.wallet.lifetime)}`, 'green'),
  ]));

  holder.append(el('div', { class: 'grid two' }, [
    el('div', { class: 'card' }, [
      el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-circle-check', style: 'color:var(--accent-green)' }), el('span', { text: t('eligibility') })]),
      el('p', { class: 'muted', text: t('monetization_rules') }),
      el('div', { class: 'stack', style: 'margin-top:14px' }, [
        p(t('subscribers'), ch.channel.subscribers, 1000),
        p(t('watch_hours'), st.watch_hours, 4000),
        p(t('shorts') + ' — ' + t('views'), st.short_views, 10_000_000),
      ]),
      el('div', { style: 'margin-top:16px' }, [
        el('span', { class: 'badge ' + (el0.eligible ? 'green' : 'grey'), text: el0.eligible ? t('monetization_eligible') : t('not_eligible') }),
      ]),
    ]),
    el('div', { class: 'card' }, [
      el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-chart-pie' }), el('span', { text: t('revenue_split') })]),
      el('div', { class: 'stack' }, [
        el('div', {}, [
          el('b', { text: t('long') }),
          el('div', { class: 'split-bar', style: 'margin-top:6px' }, [
            el('div', { class: 'creator', style: 'flex:55', text: '55%' }),
            el('div', { class: 'platform', style: 'flex:45', text: '45%' }),
          ]),
        ]),
        el('div', {}, [
          el('b', { text: t('shorts') }),
          el('div', { class: 'split-bar', style: 'margin-top:6px' }, [
            el('div', { class: 'creator', style: 'flex:45', text: '45%' }),
            el('div', { class: 'platform', style: 'flex:55', text: '55%' }),
          ]),
        ]),
      ]),
      el('div', { class: 'row', style: 'margin-top:16px' }, [
        el('button', { class: 'btn primary', onclick: () => uploadModal(), html: '<i class="fa-solid fa-plus"></i> ' + t('new_video') }),
        el('button', { class: 'btn', onclick: () => navigate('wallet'), html: '<i class="fa-solid fa-wallet"></i> ' + t('wallet') }),
      ]),
    ]),
  ]));

  holder.append(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h3', { class: 'section-title', style: 'margin:0' }, [el('i', { class: 'fa-solid fa-film' }), el('span', { text: t('videos') })]),
      el('button', { class: 'btn success sm', onclick: () => uploadModal(), html: '<i class="fa-solid fa-upload"></i> ' + t('upload') }),
    ]),
    ch.videos.length
      ? el('table', { class: 'table', style: 'margin-top:12px' }, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: t('title') }), el('th', { text: t('video_kind') }),
            el('th', { text: t('views') }), el('th', { text: t('like') }), el('th', { text: '' }),
          ])]),
          el('tbody', {}, ch.videos.map((v) => el('tr', {}, [
            el('td', {}, [el('b', { text: v.title }), el('div', { class: 'dim', text: relTime(v.created_at) })]),
            el('td', {}, [el('span', { class: 'badge ' + (v.kind === 'short' ? 'green' : v.is_live ? 'red' : 'grey'), text: v.kind === 'short' ? t('shorts') : v.is_live ? t('live') : t('long') })]),
            el('td', { text: fmtNum(v.views) }),
            el('td', { text: fmtNum(v.likes) }),
            el('td', {}, [
              el('button', {
                class: 'btn sm', onclick: () => navigate(`watch/${v.id}`), html: '<i class="fa-solid fa-eye"></i>',
              }),
            ]),
          ]))),
        ])
      : el('p', { class: 'dim', style: 'margin-top:10px', text: t('no_videos') }),
  ]));
}

function p(label, cur, target) {
  const pct = target > 0 ? Math.min(100, (cur / target) * 100) : 0;
  return el('div', {}, [
    el('div', { class: 'row between' }, [
      el('span', { class: 'muted', text: label }),
      el('span', { class: 'dim', text: `${fmtNum(cur)} / ${fmtNum(target)} (${pct.toFixed(1)}%)` }),
    ]),
    el('div', { style: 'margin-top:6px' }, [progressBar(cur, target, true)]),
  ]);
}

function uploadModal() {
  const title = el('input', { class: 'input', placeholder: t('title') });
  const desc = el('textarea', { class: 'input', rows: 3, placeholder: t('description') });
  const thumb = el('input', { class: 'input', placeholder: t('thumbnail') + ' (https://…)' });
  const src = el('input', { class: 'input', placeholder: t('source_url') + ' (https://… .mp4)' });
  const kind = el('select', { class: 'input' }, [
    el('option', { value: 'long', text: t('long') }),
    el('option', { value: 'short', text: t('shorts') }),
    el('option', { value: 'live', text: t('live_stream') }),
  ]);

  openModal({
    title: t('new_video'),
    wide: true,
    body: el('div', { class: 'stack' }, [
      el('div', { class: 'field' }, [el('label', { text: t('title') }), title]),
      el('div', { class: 'field' }, [el('label', { text: t('description') }), desc]),
      el('div', { class: 'form-grid' }, [
        el('div', { class: 'field' }, [el('label', { text: t('video_kind') }), kind]),
        el('div', { class: 'field' }, [el('label', { text: t('thumbnail') }), thumb]),
      ]),
      el('div', { class: 'field' }, [el('label', { text: t('source_url') }), src]),
    ]),
    footer: [
      el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn primary', html: '<i class="fa-solid fa-upload"></i> ' + t('publish'),
        onclick: async (e) => {
          if (!title.value.trim()) return toast(t('title'), 'error');
          e.currentTarget.disabled = true;
          try {
            const r = await post('/api/videos', {
              title: title.value.trim(), description: desc.value,
              thumbnail: thumb.value.trim(), source_url: src.value.trim(), kind: kind.value,
            });
            toast(t('published'));
            closeModal();
            navigate(`watch/${r.id}`);
          } catch (err) { toast(err.message, 'error'); }
          e.currentTarget.disabled = false;
        },
      }),
    ],
  });
}
