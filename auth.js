/* Auth — phone-based registration with programmatic validation (no OTP) */
import {
  el, t, get, post, state, navigate, toast, fmtNum, LS, openModal, closeModal,
} from '../core.js';

let metaCache = null;
async function authMeta() {
  if (metaCache) return metaCache;
  metaCache = await get('/api/auth/meta');
  return metaCache;
}

export async function loginPage(main) {
  const meta = await authMeta();
  const dialInput = el('select', { class: 'input flag-select', id: 'login-dial' },
    meta.countries.map((c) => el('option', { value: '+' + c.dial, selected: c.iso === 'EG' ? true : null }, [`${c.flag} +${c.dial} — ${c.name}`])));
  const phoneInput = el('input', { class: 'input', type: 'tel', placeholder: '10xxxxxxxx', id: 'login-phone' });
  const err = el('div', { class: 'error hidden' });
  const submit = el('button', { class: 'btn primary block', html: '<i class="fa-solid fa-right-to-bracket"></i> ' + t('login') });

  submit.onclick = async () => {
    submit.disabled = true;
    err.classList.add('hidden');
    try {
      const r = await post('/api/auth/login', { dial: dialInput.value, phone: phoneInput.value });
      localStorage.setItem(LS.token, r.token);
      state.token = r.token;
      state.user = r.user;
      toast(t('login'));
      navigate('home');
      window.__rerender && window.__rerender();
    } catch (e) {
      err.textContent = e.message.includes('kود') || e.message.includes('كود') ? t('invalid_phone') : e.message;
      err.classList.remove('hidden');
      phoneInput.classList.add('invalid');
    }
    submit.disabled = false;
  };

  main.append(el('div', { class: 'auth-wrap' }, [
    el('div', { class: 'auth-card card' }, [
      el('div', { class: 'auth-hero' }, [
        el('div', { class: 'logo-lg' }, [el('span', { class: 'brand-mark', text: 'C' }), el('span', {}, ['Craft', el('span', { style: 'color:var(--accent-green)', text: 'Hub' })])]),
        el('p', { class: 'muted', text: t('login_hint') }),
      ]),
      el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { text: t('country') }), dialInput]),
        el('div', { class: 'field' }, [el('label', { text: t('phone') }), phoneInput, err]),
        submit,
        el('div', { class: 'row between' }, [
          el('span', { class: 'dim', text: t('signup') + '?' }),
          el('button', { class: 'btn ghost', text: t('signup'), onclick: () => navigate('signup') }),
        ]),
      ]),
    ]),
  ]));
}

export async function signupPage(main) {
  const meta = await authMeta();
  const sectors = meta.sectors;

  const fullName = el('input', { class: 'input', placeholder: 'محمد أحمد / John Doe' });
  const email = el('input', { class: 'input', type: 'email', placeholder: 'name@example.com' });
  const age = el('input', { class: 'input', type: 'number', min: '13', max: '100', placeholder: '28' });
  const gender = el('select', { class: 'input' }, [
    el('option', { value: 'male', text: t('male') }),
    el('option', { value: 'female', text: t('female') }),
  ]);
  const dial = el('select', { class: 'input flag-select' },
    meta.countries.map((c) => el('option', { value: '+' + c.dial, selected: c.iso === 'EG' ? true : null }, [`${c.flag} +${c.dial} ${c.name}`])));
  const phone = el('input', { class: 'input', type: 'tel', placeholder: '10xxxxxxxx' });
  const phoneErr = el('div', { class: 'error hidden' });
  const phoneHint = el('div', { class: 'hint' });

  const sectorSel = el('select', { class: 'input' }, sectors.map((s) => el('option', { value: s.id }, [`${s.ar} | ${s.en}`])));
  const profSel = el('select', { class: 'input' });

  function paintProfs() {
    const s = sectors.find((x) => x.id === sectorSel.value) || sectors[0];
    profSel.replaceChildren(...s.professions.map((p) => el('option', { value: p.id }, [`${p.ar} | ${p.en}`])));
  }
  sectorSel.onchange = paintProfs;
  paintProfs();

  const company = el('input', { type: 'checkbox' });
  const companyWrap = el('label', { class: 'row', style: 'gap:10px' }, [company, el('span', { text: t('company_account') + ' — ' + t('verified_company_req') })]);

  /* live programmatic phone validation */
  let validateTimer = null;
  async function validatePhone() {
    const dialCode = dial.value;
    const raw = phone.value.trim();
    if (!raw) { phoneHint.textContent = ''; phone.classList.remove('invalid'); phoneErr.classList.add('hidden'); return; }
    try {
      const r = await post('/api/auth/validate-phone', { dial: dialCode, phone: raw });
      if (r.valid) {
        phone.classList.remove('invalid');
        phoneErr.classList.add('hidden');
        phoneHint.textContent = `✓ ${r.country.flag} ${r.country.name} — +${String(r.country.dial).replace(/[^0-9-]/g, '')}${r.national}`;
      } else {
        phone.classList.add('invalid');
        phoneErr.textContent = t('invalid_phone');
        phoneErr.classList.remove('hidden');
        phoneHint.textContent = '';
      }
    } catch { /* ignore */ }
  }
  const debounceValidate = () => { clearTimeout(validateTimer); validateTimer = setTimeout(validatePhone, 220); };
  phone.addEventListener('input', debounceValidate);
  dial.addEventListener('change', validatePhone);

  const steps = el('div', { class: 'steps' }, [
    el('span', { class: 'step on', html: '<i class="fa-solid fa-1"></i> ' + t('account') }),
    el('span', { class: 'step', html: '<i class="fa-solid fa-2"></i> ' + t('phone') }),
    el('span', { class: 'step', html: '<i class="fa-solid fa-3"></i> ' + t('profession') }),
  ]);

  const submit = el('button', { class: 'btn primary block', style: 'margin-top:18px', html: '<i class="fa-solid fa-user-plus"></i> ' + t('signup') });

  submit.onclick = async () => {
    // client-side guards first
    if (!fullName.value.trim()) return toast(t('full_name'), 'error');
    if (!email.value.trim()) return toast(t('email'), 'error');
    if (!age.value) return toast(t('age'), 'error');

    const vres = await post('/api/auth/validate-phone', { dial: dial.value, phone: phone.value }).catch(() => null);
    if (!vres || !vres.valid) {
      phone.classList.add('invalid');
      phoneErr.textContent = t('invalid_phone');
      phoneErr.classList.remove('hidden');
      return toast(t('invalid_phone'), 'error');
    }

    submit.disabled = true;
    try {
      const r = await post('/api/auth/register', {
        full_name: fullName.value.trim(),
        dial: dial.value,
        phone: phone.value.trim(),
        email: email.value.trim(),
        age: Number(age.value),
        gender: gender.value,
        sector_id: sectorSel.value,
        profession_id: profSel.value,
        is_company: company.checked,
      });
      localStorage.setItem(LS.token, r.token);
      state.token = r.token;
      state.user = r.user;
      toast(t('channel_created'));
      navigate(`channel/${r.user.handle}`);
      window.__rerender && window.__rerender();
    } catch (e) {
      toast(e.message, 'error');
    }
    submit.disabled = false;
  };

  main.append(el('div', { class: 'auth-wrap' }, [
    el('div', { class: 'auth-card card' }, [
      el('div', { class: 'auth-hero' }, [
        el('div', { class: 'logo-lg' }, [el('span', { class: 'brand-mark', text: 'C' }), el('span', {}, ['Craft', el('span', { style: 'color:var(--accent-green)', text: 'Hub' })])]),
        el('p', { class: 'muted', text: t('signup_hint') }),
      ]),
      steps,
      el('div', { class: 'form-grid' }, [
        el('div', { class: 'field' }, [el('label', { text: t('full_name') }), fullName]),
        el('div', { class: 'field' }, [el('label', { text: t('email') }), email]),
        el('div', { class: 'field' }, [el('label', { text: t('age') }), age]),
        el('div', { class: 'field' }, [el('label', { text: t('gender') }), gender]),
      ]),
      el('div', { class: 'spacer-4' }),
      el('div', { style: 'font-weight:800;margin-bottom:8px' }, [el('i', { class: 'fa-solid fa-phone', style: 'color:var(--accent-green)' }), ' ' + t('phone')]),
      el('div', { class: 'phone-row' }, [dial, phone]),
      phoneErr, phoneHint,
      el('div', { class: 'spacer-4' }),
      el('div', { style: 'font-weight:800;margin-bottom:8px' }, [el('i', { class: 'fa-solid fa-briefcase', style: 'color:var(--accent-red)' }), ' ' + t('profession') + ` (${meta.total_professions})`]),
      el('div', { class: 'form-grid' }, [
        el('div', { class: 'field' }, [el('label', { text: t('sector') }), sectorSel]),
        el('div', { class: 'field' }, [el('label', { text: t('profession') }), profSel]),
      ]),
      el('div', { class: 'spacer-4' }),
      companyWrap,
      submit,
      el('div', { class: 'row', style: 'justify-content:center;margin-top:14px' }, [
        el('span', { class: 'dim', text: t('login') + '?' }),
        el('button', { class: 'btn ghost', text: t('login'), onclick: () => navigate('login') }),
      ]),
    ]),
  ]));
}
