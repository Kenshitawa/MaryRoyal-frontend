// --- Dark Mode Logic ---
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = document.getElementById('theme-icon');
        const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
        const mobileThemeIcon = document.getElementById('mobile-theme-icon');

        function setTheme(isDark) {
            if (isDark) {
                document.documentElement.classList.add('dark');
                if (themeIcon) themeIcon.className = 'fas fa-sun text-amber-400';
                if (mobileThemeIcon) mobileThemeIcon.className = 'fas fa-sun text-amber-400';
                try { localStorage.setItem('mary-theme', 'dark'); } catch {}
            } else {
                document.documentElement.classList.remove('dark');
                if (themeIcon) themeIcon.className = 'fas fa-moon';
                if (mobileThemeIcon) mobileThemeIcon.className = 'fas fa-moon';
                try { localStorage.setItem('mary-theme', 'light'); } catch {}
            }
        }

        // Initialize theme preference
        let savedTheme = null;
        try { savedTheme = localStorage.getItem('mary-theme'); } catch {}
        setTheme(savedTheme === 'dark');

        themeToggle.addEventListener('click', () => setTheme(!document.documentElement.classList.contains('dark')));
        mobileThemeToggle.addEventListener('click', () => setTheme(!document.documentElement.classList.contains('dark')));

        // --- Mobile Drawer Controls & Accessibility ---
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
        const mobileNavBackdrop = document.getElementById('mobile-nav-backdrop');
        const menuIconBars = document.getElementById('menu-icon-bars');
        const menuIconClose = document.getElementById('menu-icon-close');

        function openMobileMenu() {
            mobileNavDrawer.classList.remove('translate-x-full');
            mobileNavBackdrop.classList.remove('hidden');
            document.body.classList.add('scroll-locked');
            mobileMenuBtn.setAttribute('aria-expanded', 'true');
            mobileMenuBtn.setAttribute('aria-label', 'Close Navigation Menu');
            menuIconBars.classList.add('hidden');
            menuIconClose.classList.remove('hidden');
        }

        function closeMobileMenu() {
            mobileNavDrawer.classList.add('translate-x-full');
            mobileNavBackdrop.classList.add('hidden');
            document.body.classList.remove('scroll-locked');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            mobileMenuBtn.setAttribute('aria-label', 'Open Navigation Menu');
            menuIconBars.classList.remove('hidden');
            menuIconClose.classList.add('hidden');
        }

        mobileMenuBtn.addEventListener('click', () => {
            const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        });

        // Close mobile drawer on Escape key press
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMobileMenu();
                closeModal('admissions-modal');
                closeLightbox();
            }
        });

        // --- Modal Management ---
        function openModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove('hidden');
                document.body.classList.add('scroll-locked');
            }
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add('hidden');
                document.body.classList.remove('scroll-locked');
            }
        }

        function closeModalOnOutsideClick(event, id) {
            if (event.target.id === id) {
                closeModal(id);
            }
        }

        // --- Form Submission Helpers ---
        function handleFormSubmit(event) {
            event.preventDefault();
            const form = event.currentTarget;
            if (!form.reportValidity()) return;
            const fields = new FormData(form);
            const body = [
                `Name: ${fields.get('fullName') || ''}`,
                `Email: ${fields.get('email') || ''}`,
                `Phone: ${fields.get('phone') || ''}`,
                `Inquiry: ${fields.get('subject') || 'General question'}`,
                '',
                String(fields.get('message') || '')
            ].join("\n");
            const alertBox = document.getElementById('form-alert');
            alertBox.className = "mt-4 p-4 rounded-xl text-sm font-semibold bg-blue-50 text-blue-900 dark:bg-slate-800 dark:text-blue-100 block";
            alertBox.textContent = "Your email app will open with your message. Please review it and press Send to contact the school.";
            window.location.href = `mailto:maryroyalschool81@gmail.com?subject=${encodeURIComponent('Website enquiry')}&body=${encodeURIComponent(body)}`;
        }

        // --- Lightbox Gallery ---
        function openLightbox(imgSrc, caption) {
            document.getElementById('lightbox-img').src = imgSrc;
            document.getElementById('lightbox-caption').textContent = caption;
            document.getElementById('lightbox-modal').classList.remove('hidden');
            document.body.classList.add('scroll-locked');
        }

        function closeLightbox() {
            document.getElementById('lightbox-modal').classList.add('hidden');
            document.body.classList.remove('scroll-locked');
        }

        Object.assign(window, { openModal, closeModalOnOutsideClick, handleFormSubmit, openLightbox });
