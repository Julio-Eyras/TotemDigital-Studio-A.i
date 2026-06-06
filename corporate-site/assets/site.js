const WHATSAPP_NUMBER = '5551995956450';

function openWhatsApp(msg) {
    const encodedMsg = encodeURIComponent(msg);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMsg}`;
    window.open(url, '_blank');
}

function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileMenuBtn || !mobileMenu) return;
    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
    });
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.section-fade').forEach(el => observer.observe(el));
}

function initNavbarScroll() {
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        navbar.style.borderBottom = window.pageYOffset > 100
            ? '1px solid rgba(255,255,255,0.1)'
            : '1px solid rgba(255,255,255,0.05)';
    });
}

function initHeroSegmentosDropdown() {
    const heroBtn = document.getElementById('hero-segmentos-btn');
    const heroDropdown = document.getElementById('hero-segmentos-dropdown');
    const heroWrap = document.getElementById('hero-segmentos-wrap');

    function closeHeroDropdown() {
        if (!heroDropdown || !heroBtn) return;
        heroDropdown.classList.add('hidden');
        heroBtn.classList.remove('open');
        heroBtn.setAttribute('aria-expanded', 'false');
    }

    if (heroBtn && heroDropdown) {
        heroBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !heroDropdown.classList.contains('hidden');
            if (isOpen) closeHeroDropdown();
            else {
                heroDropdown.classList.remove('hidden');
                heroBtn.classList.add('open');
                heroBtn.setAttribute('aria-expanded', 'true');
            }
        });
        document.addEventListener('click', (e) => {
            if (heroWrap && !heroWrap.contains(e.target)) closeHeroDropdown();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeHeroDropdown();
        });
    }
}

function initSegmentosDropdown() {
    const navSegmentosBtn = document.getElementById('nav-segmentos-btn');
    const navSegmentosDropdown = document.getElementById('nav-segmentos-dropdown');
    const navSegmentosWrap = document.getElementById('nav-segmentos-wrap');

    function closeSegmentosDropdown() {
        if (!navSegmentosDropdown || !navSegmentosBtn) return;
        navSegmentosDropdown.classList.add('hidden');
        navSegmentosBtn.classList.remove('open');
        navSegmentosBtn.setAttribute('aria-expanded', 'false');
    }

    if (navSegmentosBtn && navSegmentosDropdown) {
        navSegmentosBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !navSegmentosDropdown.classList.contains('hidden');
            if (isOpen) closeSegmentosDropdown();
            else {
                navSegmentosDropdown.classList.remove('hidden');
                navSegmentosBtn.classList.add('open');
                navSegmentosBtn.setAttribute('aria-expanded', 'true');
            }
        });
        document.addEventListener('click', (e) => {
            if (navSegmentosWrap && !navSegmentosWrap.contains(e.target)) closeSegmentosDropdown();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSegmentosDropdown();
        });
    }

    const mobileSegmentosBtn = document.getElementById('mobile-segmentos-btn');
    const mobileSegmentosList = document.getElementById('mobile-segmentos-list');
    if (mobileSegmentosBtn && mobileSegmentosList) {
        mobileSegmentosBtn.addEventListener('click', () => {
            mobileSegmentosList.classList.toggle('hidden');
            const chevron = mobileSegmentosBtn.querySelector('.mobile-segmentos-chevron');
            if (chevron) chevron.classList.toggle('rotate-180');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initScrollAnimations();
    initNavbarScroll();
    initSegmentosDropdown();
    initHeroSegmentosDropdown();
});
