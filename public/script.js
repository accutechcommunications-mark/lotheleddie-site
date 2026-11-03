// Lothel Eddie — interaction layer

(function () {
  const header = document.getElementById('siteHeader');
  const form = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  const errorBox = document.getElementById('formError');
  const submitBtn = document.getElementById('submitBtn');
  const donateTriggers = document.querySelectorAll('.js-open-donate');
  const modal = document.getElementById('donationModal');
  const modalPanel = modal ? modal.querySelector('.modal__panel') : null;
  const closeModalBtn = document.getElementById('closeDonateModal');
  const donationForm = document.getElementById('donationForm');
  const donationError = document.getElementById('donationError');
  const amountInput = document.getElementById('donationAmount');
  const presetButtons = document.querySelectorAll('.preset-amount');
  const donationSubmitBtn = document.getElementById('submitDonation');
  const cancelNotice = document.getElementById('donationCancelNotice');

  if (cancelNotice) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('donation') === 'cancelled') {
      cancelNotice.hidden = false;
      cancelNotice.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (history.replaceState) {
        const cleanUrl = window.location.pathname + window.location.hash;
        history.replaceState({}, document.title, cleanUrl);
      }
    }
  }

  let lastTrigger = null;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  // Sticky header shadow on scroll
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 8) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Donation modal helpers
  function isModalOpen() {
    return modal && modal.getAttribute('aria-hidden') === 'false';
  }

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(focusableSelector)).filter((el) => {
      return !el.hasAttribute('hidden') && el.offsetParent !== null;
    });
  }

  function openModal(trigger) {
    if (!modal) return;

    lastTrigger = trigger || document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    window.setTimeout(() => {
      if (amountInput) amountInput.focus();
      else if (modalPanel) modalPanel.focus();
    }, 20);
  }

  function closeModal() {
    if (!modal) return;

    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    if (donationError) {
      donationError.textContent = '';
    }

    if (donationSubmitBtn) {
      donationSubmitBtn.disabled = false;
      donationSubmitBtn.textContent = 'Continue to Secure Checkout';
    }

    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
  }

  function trapModalFocus(event) {
    if (!isModalOpen() || event.key !== 'Tab' || !modalPanel) return;

    const focusable = getFocusableElements(modalPanel);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (modalPanel) {
    modalPanel.setAttribute('tabindex', '-1');
  }

  donateTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openModal(trigger));
  });

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target.matches('[data-close-modal]')) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (!isModalOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    trapModalFocus(event);
  });

  // Donation amount preset buttons
  if (amountInput && presetButtons.length) {
    presetButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const amount = button.dataset.amount || '';
        amountInput.value = amount;

        presetButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });

    amountInput.addEventListener('input', () => {
      presetButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.amount === amountInput.value);
      });
    });
  }

  // Donation form -> Cloudflare function -> Stripe Checkout
  if (donationForm) {
    donationForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (donationError) donationError.textContent = '';

      const formData = new FormData(donationForm);
      const amount = Number(formData.get('amount'));
      const email = String(formData.get('email') || '').trim();

      if (!amount || amount < 1) {
        if (donationError) donationError.textContent = 'Please enter a valid donation amount.';
        if (amountInput) amountInput.focus();
        return;
      }

      if (!email) {
        if (donationError) donationError.textContent = 'Please enter your email address.';
        const donorEmail = document.getElementById('donorEmail');
        if (donorEmail) donorEmail.focus();
        return;
      }

      const payload = {
        amount,
        frequency: String(formData.get('frequency') || 'one_time'),
        name: String(formData.get('name') || '').trim(),
        email,
        message: String(formData.get('message') || '').trim(),
        anonymous: formData.get('anonymous') === 'on'
      };

      const originalLabel = donationSubmitBtn ? donationSubmitBtn.textContent : 'Continue to Secure Checkout';

      if (donationSubmitBtn) {
        donationSubmitBtn.disabled = true;
        donationSubmitBtn.textContent = 'Redirecting...';
      }

      try {
        const response = await fetch('/api/create-donation-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Unable to start secure checkout.');
        }

        if (!data.url) {
          throw new Error('Stripe checkout URL was not returned.');
        }

        window.location.href = data.url;
      } catch (error) {
        if (donationError) {
          donationError.textContent = error.message || 'Something went wrong starting checkout.';
        }

        if (donationSubmitBtn) {
          donationSubmitBtn.disabled = false;
          donationSubmitBtn.textContent = originalLabel;
        }
      }
    });
  }

  // Contact form — wired to Formspree
  if (form && success && errorBox && submitBtn) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const nameField = form.querySelector('#name');
      const emailField = form.querySelector('#email');
      const name = nameField ? nameField.value.trim() : '';
      const email = emailField ? emailField.value.trim() : '';

      if (!name) {
        if (nameField) nameField.focus();
        return;
      }

      if (!email) {
        if (emailField) emailField.focus();
        return;
      }

      errorBox.hidden = true;

      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        });

        if (response.ok) {
          Array.from(form.children).forEach((child) => {
            if (child.id !== 'formSuccess') child.style.display = 'none';
          });

          success.hidden = false;
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          let detail = '';

          try {
            const data = await response.json();
            if (data && Array.isArray(data.errors) && data.errors.length) {
              detail = ' (' + data.errors.map((er) => er.message).join('; ') + ')';
            }
          } catch (_) {}

          const errMsg = errorBox.querySelector('p');
          if (errMsg && detail) {
            errMsg.innerHTML =
              'We couldn’t submit your message' +
              detail +
              '. Please try again, or email us directly at <a href="mailto:contact@lotheleddie.org">contact@lotheleddie.org</a>.';
          }

          errorBox.hidden = false;
          errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      } catch (err) {
        errorBox.hidden = false;
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }

  // Smooth scroll for in-page anchor clicks
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const id = anchor.getAttribute('href');
      if (!id || id.length <= 1) return;

      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();

      const headerHeight = header ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight + 1;

      window.scrollTo({ top, behavior: 'smooth' });
      history.pushState(null, '', id);
    });
  });
})();

// Accessibility toggle — Atkinson Hyperlegible font mode
(function () {
  const KEY = 'lotheleddie-a11y';
  const VALUE = 'hyperlegible';
  const btn = document.querySelector('.a11y-toggle');

  if (!btn) return;

  function isOn() {
    try {
      return localStorage.getItem(KEY) === VALUE;
    } catch (e) {
      return false;
    }
  }

  function apply(on) {
    if (on) {
      document.documentElement.setAttribute('data-a11y', VALUE);
      try {
        localStorage.setItem(KEY, VALUE);
      } catch (e) {}
    } else {
      document.documentElement.removeAttribute('data-a11y');
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    }

    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute(
      'aria-label',
      on
        ? 'Turn off accessible font (Atkinson Hyperlegible)'
        : 'Turn on accessible font (Atkinson Hyperlegible)'
    );
  }

  apply(isOn());

  btn.addEventListener('click', function (e) {
    apply(!isOn());

    if (e.detail !== 0) {
      btn.blur();
    }
  });
})();