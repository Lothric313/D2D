const header = document.querySelector('.header');
const brandOutline = header.querySelector('.brand-outline');
const navigation = document.querySelector('.nav');
const menu = document.querySelector('.menu-toggle');
const navLinks = [...navigation.querySelectorAll('a:not(.nav-book)')];
const sections = navLinks.map((link) => document.querySelector(link.hash));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const services = [...document.querySelectorAll('.service')];
const serviceAnimations = new Map();
const serviceStates = new Map(services.map((service) => [service, service.open]));

// Keep native details behavior if JavaScript is unavailable.
services.forEach((service) => service.removeAttribute('name'));

function setServiceOpen(service, open) {
  if (serviceStates.get(service) === open) return;
  serviceStates.set(service, open);
  const start = service.getBoundingClientRect().height;
  serviceAnimations.get(service)?.cancel();
  service.open = true;
  const style = getComputedStyle(service);
  const end = open
    ? service.getBoundingClientRect().height
    : service.querySelector('summary').getBoundingClientRect().height + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

  if (reducedMotion.matches) {
    service.open = open;
    return;
  }
  const animation = service.animate({ height: [`${start}px`, `${end}px`] }, {
    duration: 350, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards',
  });
  serviceAnimations.set(service, animation);
  animation.onfinish = () => {
    service.open = open;
    animation.cancel();
    serviceAnimations.delete(service);
  };
}

services.forEach((service) => service.querySelector('summary').addEventListener('click', (event) => {
  event.preventDefault();
  const open = !serviceStates.get(service);
  if (open) services.forEach((other) => { if (other !== service) setServiceOpen(other, false); });
  setServiceOpen(service, open);
}));

const servicesSection = document.querySelector('#services');
const servicesLayout = servicesSection.querySelector('.services-layout');
const servicesStripe = servicesSection.querySelector('.stripe');
const catalog = document.querySelector('#catalog');
const catalogOpen = document.querySelector('#catalog-open');
const catalogTitle = document.querySelector('#catalog-title');
const productDialog = document.querySelector('#product-dialog');
const maxDialog = document.querySelector('#max-dialog');
const maxPhone = document.querySelector('#max-phone');
const maxStatus = document.querySelector('#max-status');
const orderTelegram = document.querySelector('#order-telegram');
const orderWhatsApp = document.querySelector('#order-whatsapp');
const phoneNumber = maxPhone.value.replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7');
let catalogTransitioning = false;

async function setCatalog(open) {
  if (catalogTransitioning || open === servicesSection.classList.contains('is-catalog-open')) return;
  catalogTransitioning = true;
  servicesLayout.inert = true;
  catalog.inert = true;
  servicesSection.classList.add('is-catalog-moving');
  servicesSection.scrollIntoView({ block: 'start', behavior: 'instant' });
  servicesSection.classList.toggle('is-catalog-open', open);
  refreshLayout();

  const slides = [servicesLayout, servicesStripe].flatMap((panel) => panel.getAnimations());
  await Promise.allSettled(slides.map((animation) => animation.finished));

  servicesSection.classList.remove('is-catalog-moving');
  servicesSection.setAttribute('aria-labelledby', open ? 'catalog-title' : 'services-title');
  servicesLayout.inert = open;
  catalog.inert = !open;
  (open ? catalogTitle : catalogOpen).focus({ preventScroll: true });
  servicesSection.scrollIntoView({ block: 'start', behavior: 'instant' });
  catalogTransitioning = false;
  refreshLayout();
}

catalogOpen.hidden = false;
catalogOpen.addEventListener('click', () => setCatalog(true));
document.querySelector('#catalog-back').addEventListener('click', () => setCatalog(false));
catalog.querySelectorAll('.catalog-item').forEach((item, index) => {
  item.style.setProperty('--item-index', index);
});
catalog.addEventListener('click', (event) => {
  const item = event.target.closest('.catalog-item');
  if (!item) return;

  const name = item.querySelector('strong').textContent;
  const price = item.querySelector('.price').textContent;
  document.querySelector('#product-name').textContent = name;
  document.querySelector('#product-price').textContent = price;
  document.querySelector('#product-description').textContent = item.dataset.description;
  const draft = encodeURIComponent(`Здравствуйте! Хочу приобрести «${name}».\nЦена: ${price}.\nПодскажите, пожалуйста, есть ли в наличии?`);
  orderTelegram.href = `https://t.me/D2D_avtozvuk?text=${draft}`;
  orderWhatsApp.href = `https://wa.me/${phoneNumber}?text=${draft}`;
  productDialog.showModal();
  productDialog.scrollTop = 0;
});

document.querySelectorAll('[data-max-contact]').forEach((link) => {
  link.setAttribute('aria-haspopup', 'dialog');
  link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    maxStatus.textContent = '';
    maxDialog.showModal();
  });
});
document.querySelector('#max-copy-phone').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(`+${phoneNumber}`);
    maxStatus.textContent = 'Номер скопирован.';
  } catch {
    maxPhone.focus();
    maxPhone.select();
    maxStatus.textContent = 'Номер выделен. Скопируйте его вручную.';
  }
});

const phoneLandscape = '(max-width: 960px) and (max-height: 520px) and (hover: none) and (pointer: coarse)';
const mobileLayout = matchMedia(`(max-width: 720px), ${phoneLandscape}`);
const compactHeader = matchMedia(`(max-width: 840px), ${phoneLandscape}`);
const main = document.querySelector('main');
const track = document.querySelector('.speaker-track');
const visual = document.querySelector('.speaker-visual');
const poster = document.querySelector('.speaker-poster');
const canvas = document.querySelector('#speaker');
const anchors = sections.map((section) => section.querySelector('.speaker-anchor'));
const poses = [
  [.06, -.72, -.08, .115],
  [.16, .72, .17],
  [-.18, -.53, -.17],
  [.20, .66, .12],
  [.13, -.57, -.20],
];

let points = [];
let outlineBounds;
let stripesBehindLogo = [];
let visualWidth = 0;
let speakerLoading = false;
let drawSpeaker = null;
let contextLost = false;
let frame = 0;
let wheel = null;
let needsMeasure = true;
let activeSection = navLinks.findIndex((link) => link.hasAttribute('aria-current'));
let requestedSection = null;

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => value * value * (3 - 2 * value);

function measure() {
  const page = main.getBoundingClientRect();
  if (mobileLayout.matches) {
    points = sections.map((section) => ({ top: section.getBoundingClientRect().top - page.top }));
    return;
  }

  outlineBounds = brandOutline.getBoundingClientRect();
  stripesBehindLogo = anchors.map(({ parentElement }) => parentElement)
    .filter((stripe) => stripe !== servicesStripe)
    .map((stripe) => stripe.getBoundingClientRect())
    .filter(({ left, right }) => left < outlineBounds.right && right > outlineBounds.left)
    .map(({ top, right, bottom, left }) => ({ top: top + window.scrollY, right, bottom: bottom + window.scrollY, left }));
  points = sections.map((section, index) => {
    const bounds = section.getBoundingClientRect();
    const anchor = anchors[index].getBoundingClientRect();
    return {
      x: section === servicesSection
        ? bounds.left + servicesStripe.offsetLeft + servicesStripe.clientLeft + anchors[index].offsetLeft
        : anchor.left,
      y: anchor.top - page.top,
      top: bounds.top - page.top,
      bottom: bounds.bottom - page.top,
      clip: `inset(${bounds.top - page.top}px 0 ${page.bottom - bounds.bottom}px 0)`,
    };
  });

  visualWidth = visual.getBoundingClientRect().width;
  const preferredHandoff = window.innerHeight * .53;

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const next = points[index];
    const departure = previous.y - previous.top;
    const arrival = next.y - next.top;
    const clearance = Math.max(visualWidth * .46 + 18, (departure - arrival) / 2 + 24);
    const seam = Math.max(departure - clearance + 24, Math.min(preferredHandoff, arrival + clearance - 24));
    const at = next.top - seam;
    previous.exit = { at, y: seam + clearance };
    next.entry = { at, y: seam - clearance };
  }

  for (const point of points) {
    const center = point.y - point.top;
    const incomingSpeed = point.entry ? (center - point.entry.y) / (point.top - point.entry.at) : Infinity;
    const outgoingSpeed = point.exit ? (point.exit.y - center) / (point.exit.at - point.top) : Infinity;
    point.speed = Math.min(.40, incomingSpeed, outgoingSpeed);
  }
}

function updateBrandOutline(scroll) {
  const movingStripe = servicesStripe.getBoundingClientRect();
  const stripe = movingStripe.left < outlineBounds.right && movingStripe.right > outlineBounds.left
    && movingStripe.top < outlineBounds.bottom && movingStripe.bottom > outlineBounds.top
    ? { top: movingStripe.top + scroll, bottom: movingStripe.bottom + scroll, left: movingStripe.left, right: movingStripe.right }
    : stripesBehindLogo.find(({ top, bottom }) => top < scroll + outlineBounds.bottom && bottom > scroll + outlineBounds.top);
  if (!stripe) {
    brandOutline.style.clipPath = '';
    return;
  }
  const insets = [stripe.top - scroll - outlineBounds.top, outlineBounds.right - stripe.right,
    outlineBounds.bottom + scroll - stripe.bottom, stripe.left - outlineBounds.left];
  brandOutline.style.clipPath = `inset(${insets.map((inset) => `${Math.max(0, inset)}px`).join(' ')})`;
}

function update(timestamp) {
  frame = 0;
  if (catalogTransitioning) requestFrame();
  if (needsMeasure) {
    measure();
    needsMeasure = false;
  }

  if (wheel) {
    const remaining = wheel.target - wheel.position;
    if (Math.abs(remaining) < .75) {
      window.scrollTo({ top: wheel.target, behavior: 'instant' });
      wheel = null;
    } else {
      const elapsed = wheel.timestamp ? Math.min(timestamp - wheel.timestamp, 40) : 1000 / 60;
      wheel.position += remaining * (1 - Math.exp(-elapsed / 76));
      wheel.timestamp = timestamp;
      window.scrollTo({ top: wheel.position, behavior: 'instant' });
      requestFrame();
    }
  }

  const scroll = window.scrollY;
  if (mobileLayout.matches) header.classList.toggle('is-scrolled', scroll > 0);
  else updateBrandOutline(scroll);
  const viewport = window.innerHeight;
  const nearestSection = Math.max(0, points.findLastIndex(({ top }) => top <= scroll + Math.min(viewport * .32, 220)));
  if (nearestSection === requestedSection) requestedSection = null;
  setActiveSection(requestedSection ?? nearestSection);
  if (mobileLayout.matches) return;

  const index = Math.max(0, points.findLastIndex(({ entry }) => !entry || entry.at <= scroll));
  const point = points[index];
  const offset = scroll - point.top;
  const animate = !reducedMotion.matches;
  const edge = offset < 0 ? point.entry : point.exit;
  const center = point.y - point.top;
  let y = animate ? scroll + center + offset * point.speed : point.y;

  if (animate && edge) {
    // The same nonzero slope meets on both sides of the resting position.
    const duration = edge.at - point.top;
    const progress = clamp(offset / duration);
    const startMotion = point.speed * duration;
    y = scroll + center + startMotion * progress + (edge.y - center - startMotion) * progress ** 2;
  }

  // The model passes behind the section edge before changing sides.
  track.style.clipPath = point.clip;
  visual.classList.toggle('is-in-services', sections[index] === servicesSection);
  const room = Math.min(y - point.top, point.bottom - y);
  const opacity = animate ? smooth(clamp((room + visualWidth * .42) / (visualWidth * .22))) : 1;
  visual.style.transform = `translate3d(${point.x}px, ${y}px, 0) translate(-50%, -50%)`;
  visual.style.opacity = opacity;
  if (!opacity || y + visualWidth / 2 < scroll || y - visualWidth / 2 > scroll + viewport) return;
  const [pitch, yaw, restRoll, offsetX = 0] = poses[index];
  const roll = restRoll + (animate ? 2 * Math.PI * offset / (point.bottom - point.top) : 0);
  if (drawSpeaker && !contextLost) {
    drawSpeaker(visualWidth, pitch, yaw, roll, offsetX);
    visual.classList.add('is-live');
  } else {
    const centering = index === 0 ? 'translate(3%, -1.4%) ' : '';
    poster.style.transform = `${centering}rotate(${roll - restRoll}rad) scaleX(${index % 2 ? -1 : 1})`;
  }
}

function requestFrame() {
  if (!frame) frame = requestAnimationFrame(update);
}

function refreshLayout() {
  needsMeasure = true;
  requestFrame();
}

function smoothWheel(event) {
  cancelSectionJump();
  if (event.target.closest?.('dialog')) {
    wheel = null;
    return;
  }

  const mode = event.deltaMode;
  const { deltaX, deltaY } = event;
  const fineInput = mode === WheelEvent.DOM_DELTA_PIXEL && (Math.abs(deltaY) < 48 || !Number.isInteger(deltaY));
  if (!event.cancelable || mobileLayout.matches || reducedMotion.matches || fineInput || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(deltaX) >= Math.abs(deltaY)) {
    wheel = null;
    return;
  }

  event.preventDefault();
  const unit = mode === WheelEvent.DOM_DELTA_LINE ? 16 : mode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
  const delta = deltaY * unit;
  if (!wheel || (wheel.target - wheel.position) * delta < 0) {
    wheel = { position: window.scrollY, target: window.scrollY, timestamp: 0 };
  }
  const limit = document.documentElement.scrollHeight - window.innerHeight;
  wheel.target = Math.max(0, Math.min(limit, wheel.target + delta));
  requestFrame();
}

function updateIndicator() {
  const link = navLinks[activeSection];
  if (!link?.offsetWidth) return;

  navigation.style.setProperty('--active-x', `${link.offsetLeft}px`);
  navigation.style.setProperty('--active-y', `${link.offsetTop}px`);
  navigation.style.setProperty('--active-width', `${link.offsetWidth}px`);
  navigation.style.setProperty('--active-height', `${link.offsetHeight}px`);
  navigation.classList.add('has-indicator');
}

function setActiveSection(index) {
  if (index === activeSection) return;

  navLinks[activeSection]?.removeAttribute('aria-current');
  navLinks[index].setAttribute('aria-current', 'location');
  activeSection = index;
  updateIndicator();
}

function cancelSectionJump() {
  if (requestedSection === null) return;
  requestedSection = null;
  requestFrame();
}

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
  if (compactHeader.matches && !open) navigation.classList.remove('has-indicator');
  else updateIndicator();
}

menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
header.addEventListener('click', (event) => {
  if (mobileLayout.matches && event.target === header) {
    setMenu(false);
    menu.focus({ preventScroll: true });
    return;
  }

  const link = event.target.closest('a');
  if (!link || event.button || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

  const target = navLinks.findIndex((item) => item.hash === link.hash);
  if (target === -1) return;

  wheel = null;
  requestedSection = target;
  setActiveSection(target);
  setMenu(false);
});
document.addEventListener('keydown', (event) => {
  wheel = null;
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelSectionJump();
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});

const reveal = new IntersectionObserver((entries, observer) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }
}, { threshold: .1 });
document.body.classList.add('has-reveal');
document.querySelectorAll('.reveal').forEach((element) => reveal.observe(element));

const sizes = new ResizeObserver(refreshLayout);
sections.forEach((section) => sizes.observe(section));
const navSizes = new ResizeObserver(updateIndicator);
navLinks.forEach((link) => navSizes.observe(link));
window.addEventListener('resize', refreshLayout);
window.addEventListener('scroll', requestFrame, { passive: true });
window.addEventListener('wheel', smoothWheel, { passive: false });
window.addEventListener('pointerdown', () => {
  wheel = null;
  cancelSectionJump();
}, { passive: true });
window.addEventListener('hashchange', () => { wheel = null; });
reducedMotion.addEventListener('change', () => {
  wheel = null;
  requestFrame();
});
compactHeader.addEventListener('change', () => setMenu(false));
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  contextLost = true;
  visual.classList.remove('is-live');
  requestFrame();
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  requestFrame();
});

async function loadDesktopSpeaker() {
  if (mobileLayout.matches || speakerLoading || drawSpeaker) return;
  speakerLoading = true;
  try {
    const { createSpeaker } = await import('./subwoofer.js');
    if (mobileLayout.matches) return;
    drawSpeaker = createSpeaker(canvas, requestFrame);
    requestFrame();
  } catch (error) {
    console.warn('D2D: используется изображение сабвуфера', error);
  } finally {
    speakerLoading = false;
  }
}

mobileLayout.addEventListener('change', () => {
  wheel = null;
  refreshLayout();
  loadDesktopSpeaker();
});
requestFrame();
loadDesktopSpeaker();
