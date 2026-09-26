/* Wallet — earnings dashboard, CPM/RPM, withdrawals */
import {
  el, t, get, post, state, navigate, toast, fmtNum, fmtMoney, emptyState, loadingBlock,
  openModal, closeModal, statCard, progressBar,
} from '../core.js';

export async function walletPage(main) {
  if (!state.user) {
    main.append(emptyState('fa-solid fa-lock', t('login_required')));
    main.append(el('div', { class: 'row', style: 'justify-content:center' }, [
      el('button', { class: 'btn primary', text: t('login'), onclick: () => navigate('login') }),
    ]));
    return;
  }

  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-wallet', style: 'color:var(--accent-green)' }),
    el('span', { text: t('wallet') }),
  ]));

  const holder = el('div', { class: 'stack' });
  main.append(holder);
  holder.append(loadingBlock());

  let data;
  try { data = await get('/api/wallet'); }
  catch (e) { holder.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message)); return; }

  const w = data.wallet;
  const el0 = data.eligibility;
  holder.replaceChildren();

  /* --------------------------- headline stats ------------------------ */
  holder.append(el('div', { class: 'grid stats' }, [
    statCard(t('available'), fmtMoney(w.balance), w.currency || 'USD', 'money'),
    statCard(t('lifetime'), fmtMoney(w.lifetime), null, 'green'),
    statCard(t('cpm'), fmtMoney(w.cpm), null),
    statCard(t('rpm'), fmtMoney(w.rpm), null, 'red'),
  ]));

  /* -------------------------- eligibility card ---------------------- */
  if (el0.eligible) {
    holder.append(el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h3', { class: 'section-title', style: 'margin:0' }, [el('i', { class: 'fa-solid fa-circle-check', style: 'color:var(--accent-green)' }), el('span', { text: t('monetization_eligible') })]),
        el('span', { class: 'badge green', text: t('active') }),
      ]),
    ]));
  } else {
    holder.append(el('div', { class: 'card' }, [
      el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-hourglass-half', style: 'color:var(--accent-red)' }), el('span', { text: t('eligibility') })]),
      el('p', { class: 'muted', text: t('monetization_rules') }),
      el('div', { class: 'stack', style: 'margin-top:14px' }, [
        prog(t('subscribers'), el0.progress.subscribers.current, el0.progress.subscribers.target),
        prog(t('watch_hours'), el0.progress.watch_hours.current, el0.progress.watch_hours.target),
        prog(t('shorts') + ' — ' + t('views'), el0.progress.short_views.current, el0.progress.short_views.target),
      ]),
    ]));
  }

  /* ---------------------------- revenue split ----------------------- */
  holder.append(el('div', { class: 'card' }, [
    el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-chart-pie' }), el('span', { text: t('revenue_split') })]),
    el('div', { class: 'stack' }, [
      splitRow(`${t('long')} (16:9)`, 55, 45),
      splitRow(`${t('shorts')} (9:16)`, 45, 55),
    ]),
    el('p', { class: 'dim', style: 'margin-top:12px', text: t('long_share') + ' · ' + t('short_share') }),
  ]));

  /* ------------------------------ breakdown ------------------------- */
  const srcLabel = { ads_long: t('long') + ' • ' + t('ads'), ads_short: t('shorts') + ' • ' + t('ads'), premium: t('premium'), superchat: t('super_chat'), membership: t('membership') };
  holder.append(el('div', { class: 'card' }, [
    el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-sack-dollar', style: 'color:var(--accent-green)' }), el('span', { text: t('your_earnings') })]),
    data.breakdown.length
      ? el('table', { class: 'table' }, [
          el('thead', {}, [el('tr', {}, [el('th', { text: t('method') }), el('th', { text: t('earnings') }), el('th', { text: '#' })])]),
          el('tbody', {}, data.breakdown.map((b) => el('tr', {}, [
            el('td', { text: srcLabel[b.source] || b.source }),
            el('td', { style: 'color:var(--accent-green);font-weight:800', text: fmtMoney(b.total) }),
            el('td', { class: 'dim', text: String(b.n) }),
          ]))),
        ])
      : el('p', { class: 'dim', text: t('no_results') }),
  ]));

  /* ----------------------------- withdrawals ------------------------ */
  const minW = data.rules.min_withdrawal;
  holder.append(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h3', { class: 'section-title', style: 'margin:0' }, [el('i', { class: 'fa-solid fa-money-bill-transfer' }), el('span', { text: t('withdraw_funds') })]),
      el('span', { class: 'badge grey', text: t('min_withdraw') }),
    ]),
    data.withdrawals.length
      ? el('table', { class: 'table', style: 'margin-top:12px' }, [
          el('thead', {}, [el('tr', {}, [el('th', { text: t('amount') }), el('th', { text: t('method') }), el('th', { text: t('status') }), el('th', { text: '' })])]),
          el('tbody', {}, data.withdrawals.map((x) => el('tr', {}, [
            el('td', { text: fmtMoney(x.amount) }),
            el('td', { text: x.method }),
            el('td', {}, [statusBadge(x.status)]),
            el('td', { class: 'dim', text: rel(x.created_at) }),
          ]))),
        ])
      : el('p', { class: 'dim', style: 'margin-top:10px', text: t('no_results') }),
    el('div', { style: 'margin-top:14px' }, [
      el('button', { class: 'btn success', onclick: () => withdrawalModal(w, minW), html: '<i class="fa-solid fa-plus"></i> ' + t('withdraw') }),
    ]),
  ]));

  /* --------------------------- recent earnings ---------------------- */
  if (data.recent.length) {
    holder.append(el('div', { class: 'card' }, [
      el('h3', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-clock-rotate-left' }), el('span', { text: t('history') })]),
      el('table', { class: 'table' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: t('method') }), el('th', { text: 'Gross' }), el('th', { text: t('your_earnings') }), el('th', { text: t('platform_revenue') }), el('th', { text: '' })])]),
        el('tbody', {}, data.recent.map((r) => el('tr', {}, [
          el('td', { text: srcLabel[r.source] || r.source }),
          el('td', { text: fmtMoney(r.gross) }),
          el('td', { style: 'color:var(--accent-green);font-weight:800', text: fmtMoney(r.creator_share) }),
          el('td', { style: 'color:var(--accent-red);font-weight:700', text: fmtMoney(r.platform_share) }),
          el('td', { class: 'dim', text: rel(r.created_at) }),
        ]))),
      ]),
    ]));
  }
}

function prog(label, cur, target) {
  const pct = target > 0 ? Math.min(100, (cur / target) * 100) : 0;
  return el('div', {}, [
    el('div', { class: 'row between' }, [
      el('span', { class: 'muted', text: label }),
      el('span', { class: 'dim', text: `${fmtNum(cur)} / ${fmtNum(target)} (${pct.toFixed(1)}%)` }),
    ]),
    el('div', { style: 'margin-top:6px' }, [progressBar(cur, target, true)]),
  ]);
}

function splitRow(label, creatorPct, platformPct) {
  return el('div', {}, [
    el('div', { class: 'row between' }, [el('b', { text: label }), el('span', { class: 'dim', text: `${creatorPct}% / ${platformPct}%` })]),
    el('div', { class: 'split-bar', style: 'margin-top:6px' }, [
      el('div', { class: 'creator', style: `flex:${creatorPct}`, text: creatorPct + '%' }),
      el('div', { class: 'platform', style: `flex:${platformPct}`, text: platformPct + '%' }),
    ]),
  ]);
}

function statusBadge(status) {
  const map = { pending: ['grey', 'pending'], approved: ['green', 'approved'], paid: ['green', 'paid'], rejected: ['red', 'rejected'] };
  const [cls, label] = map[status] || ['grey', status];
  return el('span', { class: `badge ${cls}`, text: t(label) || label });
}

function rel(iso) {
  const d = new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z');
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '';
}

function withdrawalModal(wallet, minW) {
  const amount = el('input', { class: 'input', type: 'number', min: String(minW), step: '0.01', value: String(Math.max(minW, Math.floor(wallet.balance * 100) / 100)) });
  const method = el('select', { class: 'input' }, [
    el('option', { value: 'IBAN', text: t('iban') }),
    el('option', { value: 'PayPal', text: t('paypal') }),
    el('option', { value: 'InstaPay', text: t('instapay') }),
  ]);
  const dest = el('input', { class: 'input', placeholder: 'IBAN / email / phone' });

  openModal({
    title: t('withdraw_funds'),
    body: el('div', { class: 'stack' }, [
      el('div', { class: 'badge green', text: `${t('available')}: ${fmtMoney(wallet.balance)}` }),
      el('div', { class: 'field' }, [el('label', { text: t('amount') }), amount, el('div', { class: 'hint', text: t('min_withdraw') })]),
      el('div', { class: 'field' }, [el('label', { text: t('method') }), method]),
      el('div', { class: 'field' }, [el('label', { text: t('iban') + ' / PayPal / InstaPay' }), dest]),
    ]),
    footer: [
      el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn success', text: t('confirm'),
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          try {
            await post('/api/withdrawals', { amount: Number(amount.value), method: method.value, destination: dest.value.trim() });
            toast(t('pending'));
            closeModal();
            window.__rerender && window.__rerender();
          } catch (err) { toast(err.message, 'error'); }
          e.currentTarget.disabled = false;
        },
      }),
    ],
  });
}
