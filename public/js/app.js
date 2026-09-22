/**
 * HVNH Lecturer Schedule Hub - Clean White Automatic 5-Week Search & Offline JSON Cache
 */

document.addEventListener('DOMContentLoaded', () => {
    // App State
    const state = {
        type: 'professor',
        year: '',
        term: '',
        selectedId: 'NHH00966', // Default Nguyễn Hoàng Anh
        selectedName: 'Nguyễn Hoàng Anh',
        initialData: null,
        currentTargetOptions: [],
        multiWeekData: null,
        activeWeekIndex: 'all', // 'all' or index 0..4
        sessionFilter: 'all'
    };

    // DOM Element References
    const selectYear = document.getElementById('selectYear');
    const selectTerm = document.getElementById('selectTerm');
    const searchTargetInput = document.getElementById('searchTargetInput');
    const autocompleteResults = document.getElementById('autocompleteResults');
    const quickTagsContainer = document.getElementById('quickTagsContainer');

    const multiWeekTitle = document.getElementById('multiWeekTitle');
    const cacheBadge = document.getElementById('cacheBadge');
    const weekTabsWrapper = document.getElementById('weekTabsWrapper');
    const sessionPillBtns = document.querySelectorAll('.pill-btn');

    const timetableMultiWeekContainer = document.getElementById('timetableMultiWeekContainer');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');

    const statTotalWeeks = document.getElementById('statTotalWeeks');
    const statTotalSubjects = document.getElementById('statTotalSubjects');
    const statTotalPeriods = document.getElementById('statTotalPeriods');
    const statActiveDays = document.getElementById('statActiveDays');

    const btnExportIcs = document.getElementById('btnExportIcs');
    const btnPrint = document.getElementById('btnPrint');

    // Modal Elements
    const courseModal = document.getElementById('courseModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCloseModalBtn = document.getElementById('btnCloseModalBtn');
    const btnCopyModalDetail = document.getElementById('btnCopyModalDetail');
    const modalSessionBadge = document.getElementById('modalSessionBadge');
    const modalSubjectTitle = document.getElementById('modalSubjectTitle');
    const modalSubjectCode = document.getElementById('modalSubjectCode');
    const modalRoom = document.getElementById('modalRoom');
    const modalProfessor = document.getElementById('modalProfessor');
    const modalClass = document.getElementById('modalClass');
    const modalGroup = document.getElementById('modalGroup');
    const modalTimeRange = document.getElementById('modalTimeRange');

    let activeModalItem = null;

    // Initialize App
    initApp();

    async function initApp() {
        showLoading(true);

        try {
            const res = await fetch('/api/initial');
            const result = await res.json();

            if (result.success && result.data) {
                state.initialData = result.data;
                if (selectYear && result.data.years) populateSelect(selectYear, result.data.years);
                if (selectTerm && result.data.terms) populateSelect(selectTerm, result.data.terms);

                state.year = selectYear ? selectYear.value : '';
                state.term = selectTerm ? selectTerm.value : '';
                state.currentTargetOptions = result.data.professors || [];

                attachEventListeners();

                // Auto select Nguyễn Hoàng Anh as default
                const defaultProf = state.currentTargetOptions.find(p => p.text.includes('Nguyễn Hoàng Anh')) || state.currentTargetOptions[0];
                if (defaultProf) {
                    state.selectedId = defaultProf.value;
                    state.selectedName = defaultProf.text;
                    searchTargetInput.value = defaultProf.text;
                }

                // Auto fetch schedule immediately on load (No manual buttons needed)
                fetchMultiWeekSchedule();
            } else {
                alert('Không thể kết nối đến máy chủ HVNH. Vui lòng thử lại!');
                showLoading(false);
            }
        } catch (e) {
            console.error(e);
            alert('Lỗi kết nối máy chủ!');
            showLoading(false);
        }
    }

    function populateSelect(selectElem, items) {
        if (!selectElem) return;
        selectElem.innerHTML = '';
        if (!items || items.length === 0) return;
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = typeof item === 'object' ? item.value : item;
            opt.textContent = typeof item === 'object' ? item.text : item;
            if (item.selected) opt.selected = true;
            selectElem.appendChild(opt);
        });
    }

    function attachEventListeners() {
        // Handle 2 Quick Tags (Nguyễn Hoàng Anh & Ngô Văn Bình)
        if (quickTagsContainer) {
            quickTagsContainer.querySelectorAll('.tag-pill').forEach(tag => {
                tag.addEventListener('click', () => {
                    quickTagsContainer.querySelectorAll('.tag-pill').forEach(t => t.classList.remove('active'));
                    tag.classList.add('active');

                    const profName = tag.dataset.profName;
                    const profId = tag.dataset.profId;

                    searchTargetInput.value = profName;

                    // Match exact prof ID or text
                    const foundProf = state.currentTargetOptions.find(p => 
                        (profId && p.value === profId) || p.text.toLowerCase().includes(profName.toLowerCase())
                    );

                    if (foundProf) {
                        state.selectedId = foundProf.value;
                        state.selectedName = foundProf.text;
                    } else if (profId) {
                        state.selectedId = profId;
                        state.selectedName = profName;
                    }

                    // Automatic fetch on tag click without pressing buttons!
                    fetchMultiWeekSchedule();
                });
            });
        }

        // Auto fetch on Year & Term change (if present)
        if (selectYear) {
            selectYear.addEventListener('change', () => {
                state.year = selectYear.value;
                fetchMultiWeekSchedule();
            });
        }

        if (selectTerm) {
            selectTerm.addEventListener('change', () => {
                state.term = selectTerm.value;
                fetchMultiWeekSchedule();
            });
        }

        // Search Input Autocomplete
        if (searchTargetInput) {
            searchTargetInput.addEventListener('input', () => {
                const val = searchTargetInput.value.trim().toLowerCase();
                if (!val) {
                    autocompleteResults.classList.add('hidden');
                    return;
                }

                const matches = state.currentTargetOptions.filter(opt =>
                    opt.text.toLowerCase().includes(val) || opt.value.toLowerCase().includes(val)
                ).slice(0, 10);

                if (matches.length > 0) {
                    renderAutocomplete(matches);
                } else {
                    autocompleteResults.classList.add('hidden');
                }
            });

            searchTargetInput.addEventListener('focus', () => {
                if (searchTargetInput.value.trim()) {
                    searchTargetInput.dispatchEvent(new Event('input'));
                }
            });

            document.addEventListener('click', (e) => {
                if (!searchTargetInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
                    autocompleteResults.classList.add('hidden');
                }
            });
        }

        // Session Filters (if present)
        if (sessionPillBtns) {
            sessionPillBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    sessionPillBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    state.sessionFilter = btn.dataset.session;
                    renderMultiWeekContainer();
                });
            });
        }

        // Export ICS
        btnExportIcs.addEventListener('click', exportIcsFile);

        // Print
        btnPrint.addEventListener('click', () => window.print());

        // Modal Controls
        btnCloseModal.addEventListener('click', closeModal);
        btnCloseModalBtn.addEventListener('click', closeModal);
        courseModal.addEventListener('click', (e) => {
            if (e.target === courseModal) closeModal();
        });
        btnCopyModalDetail.addEventListener('click', copyModalDetail);
    }

    function renderAutocomplete(matches) {
        autocompleteResults.innerHTML = '';
        matches.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span><i class="fa-solid fa-user-tie text-muted"></i> ${item.text}</span> <span class="item-sub">${item.value}</span>`;
            li.addEventListener('click', () => {
                searchTargetInput.value = item.text;
                state.selectedId = item.value;
                state.selectedName = item.text;
                autocompleteResults.classList.add('hidden');
                
                // Highlight matching quick tag if any
                quickTagsContainer.querySelectorAll('.tag-pill').forEach(t => {
                    t.classList.toggle('active', item.text.includes(t.dataset.profName));
                });

                // Auto fetch immediately on selection!
                fetchMultiWeekSchedule();
            });
            autocompleteResults.appendChild(li);
        });
        autocompleteResults.classList.remove('hidden');
    }

    // Fetch Multi-Week Schedule (6 weeks with instant cache load & live status badge)
    async function fetchMultiWeekSchedule() {
        if (!state.selectedId) {
            const textVal = searchTargetInput.value.trim().toLowerCase();
            const found = state.currentTargetOptions.find(o => o.text.toLowerCase().includes(textVal) || o.value.toLowerCase().includes(textVal));
            if (found) {
                state.selectedId = found.value;
                state.selectedName = found.text;
            }
        }

        if (!state.selectedId) return;

        const profId = state.selectedId;
        showLoading(true);

        try {
            const url = `/api/multi-week-schedule?type=professor&year=${state.year}&term=${state.term}&id=${encodeURIComponent(profId)}&weeksCount=6`;
            const res = await fetch(url);
            const result = await res.json();

            showLoading(false);

            if (result.success && result.data && result.data.weeksData) {
                state.multiWeekData = result.data;
                multiWeekTitle.textContent = `Lịch giảng dạy 6 tuần: ${state.selectedName || state.selectedId}`;

                renderWeekTabs();
                renderMultiWeekContainer();
                updateStats();

                if (result.fromCache) {
                    // Display cache immediately & show syncing badge
                    cacheBadge.className = 'cache-badge status-syncing';
                    cacheBadge.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Lịch từ Cache (Đang kiểm tra cập nhật...)';
                    cacheBadge.classList.remove('hidden');

                    // Trigger live sync check in background
                    try {
                        const syncUrl = `/api/multi-week-schedule?type=professor&year=${state.year}&term=${state.term}&id=${encodeURIComponent(profId)}&weeksCount=6&sync=true`;
                        const syncRes = await fetch(syncUrl).then(r => r.json());

                        if (state.selectedId === profId && syncRes.success) {
                            if (syncRes.isUpdated) {
                                state.multiWeekData = syncRes.data;
                                renderWeekTabs();
                                renderMultiWeekContainer();
                                updateStats();
                                cacheBadge.className = 'cache-badge status-updated';
                                cacheBadge.innerHTML = '<i class="fa-solid fa-bolt"></i> Vừa tự động cập nhật thay đổi!';
                            } else {
                                cacheBadge.className = 'cache-badge status-synced';
                                cacheBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đã đồng bộ mới nhất';
                            }
                        }
                    } catch (syncErr) {
                        console.error('Background sync check failed:', syncErr);
                        if (state.selectedId === profId) {
                            cacheBadge.className = 'cache-badge status-synced';
                            cacheBadge.innerHTML = '<i class="fa-solid fa-database"></i> Đã tải từ Offline Cache';
                        }
                    }
                } else {
                    cacheBadge.className = 'cache-badge status-synced';
                    cacheBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đã cập nhật mới nhất';
                    cacheBadge.classList.remove('hidden');
                }
            } else {
                emptyState.classList.remove('hidden');
                timetableMultiWeekContainer.innerHTML = '';
            }
        } catch (e) {
            console.error(e);
            showLoading(false);
            emptyState.classList.remove('hidden');
        }
    }

    // Render Week Tabs Bar (All 6 Weeks | Week 1 | Week 2...)
    function renderWeekTabs() {
        weekTabsWrapper.innerHTML = '';
        if (!state.multiWeekData || !state.multiWeekData.weeksData) return;

        const weeks = state.multiWeekData.weeksData;

        // "Tất cả 6 tuần" button
        const btnAll = document.createElement('button');
        btnAll.className = `week-subtab ${state.activeWeekIndex === 'all' ? 'active' : ''}`;
        btnAll.innerHTML = `<i class="fa-solid fa-list-check"></i> Tất cả 6 tuần`;
        btnAll.addEventListener('click', () => {
            state.activeWeekIndex = 'all';
            renderWeekTabs();
            renderMultiWeekContainer();
        });
        weekTabsWrapper.appendChild(btnAll);

        weeks.forEach((w, idx) => {
            const btn = document.createElement('button');
            btn.className = `week-subtab ${state.activeWeekIndex === idx ? 'active' : ''}`;
            btn.textContent = `Tuần ${w.displayWeek || w.week}`;
            btn.addEventListener('click', () => {
                state.activeWeekIndex = idx;
                renderWeekTabs();
                renderMultiWeekContainer();
            });
            weekTabsWrapper.appendChild(btn);
        });
    }

    // Render Multi-Week Grid or Single Week Grid
    function renderMultiWeekContainer() {
        timetableMultiWeekContainer.innerHTML = '';
        if (!state.multiWeekData || !state.multiWeekData.weeksData || state.multiWeekData.weeksData.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        const weeksToRender = state.activeWeekIndex === 'all' 
            ? state.multiWeekData.weeksData 
            : [state.multiWeekData.weeksData[state.activeWeekIndex]];

        const todayDayIndex = new Date().getDay();
        const dayMapIndex = { 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 0: 'Chủ nhật' };
        const todayName = dayMapIndex[todayDayIndex];

        weeksToRender.forEach((weekObj, wIdx) => {
            const weekCard = document.createElement('div');
            weekCard.className = 'week-section-card';

            weekCard.innerHTML = `
                <div class="week-section-header">
                    <div class="week-section-title">
                        <i class="fa-solid fa-calendar-week"></i>
                        ${weekObj.weekHeader || `Tuần ${weekObj.displayWeek || weekObj.week}`}
                    </div>
                    <span class="week-badge">Tuần ${weekObj.displayWeek || weekObj.week}</span>
                </div>
                <div class="timetable-grid"></div>
            `;

            const grid = weekCard.querySelector('.timetable-grid');

            weekObj.days.forEach(day => {
                const isToday = day.dayName === todayName && wIdx === 0;

                const dayCol = document.createElement('div');
                dayCol.className = `day-column ${isToday ? 'is-today' : ''}`;

                dayCol.innerHTML = `
                    <div class="day-header">
                        <div class="day-title">${day.dayName}</div>
                        ${isToday ? '<span class="today-badge">Hôm nay</span>' : ''}
                    </div>
                    <div class="day-body"></div>
                `;

                const dayBody = dayCol.querySelector('.day-body');
                const sessionsToRender = state.sessionFilter === 'all' ? ['Sáng', 'Chiều', 'Tối'] : [state.sessionFilter];
                let hasLessonInDay = false;

                sessionsToRender.forEach(session => {
                    const lessons = day.sessions[session] || [];
                    if (lessons.length > 0) {
                        hasLessonInDay = true;
                        const sessionBlock = document.createElement('div');
                        sessionBlock.className = 'session-block';

                        if (state.sessionFilter === 'all') {
                            const iconMap = { 'Sáng': 'fa-sun', 'Chiều': 'fa-cloud-sun', 'Tối': 'fa-moon' };
                            sessionBlock.innerHTML = `<div class="session-title"><i class="fa-solid ${iconMap[session]}"></i> Ca ${session}</div>`;
                        }

                        lessons.forEach(item => {
                            const card = document.createElement('div');
                            const sessionClass = session === 'Sáng' ? 'session-sang' : (session === 'Chiều' ? 'session-chieu' : 'session-toi');
                            card.className = `course-card ${sessionClass}`;

                            card.innerHTML = `
                                <div class="card-header-row">
                                    <span class="period-badge">Ca ${item.period || session}</span>
                                    ${item.room ? `<span class="room-badge"><i class="fa-solid fa-location-dot"></i> ${item.room}</span>` : ''}
                                </div>
                                <div class="course-title">${item.subject || 'Môn học'}</div>
                                ${item.subjectCode ? `<div class="course-code">${item.subjectCode}</div>` : ''}
                                <div class="course-meta">
                                    ${item.classId ? `<div><i class="fa-solid fa-users"></i> Lớp: ${item.classId}</div>` : ''}
                                    ${item.group ? `<div><i class="fa-solid fa-layer-group"></i> Nhóm: ${item.group}</div>` : ''}
                                </div>
                            `;

                            card.addEventListener('click', () => openCourseModal(item, session));
                            sessionBlock.appendChild(card);
                        });

                        dayBody.appendChild(sessionBlock);
                    }
                });

                if (!hasLessonInDay) {
                    dayBody.innerHTML = '<div class="no-class-msg">Không có lịch</div>';
                }

                grid.appendChild(dayCol);
            });

            timetableMultiWeekContainer.appendChild(weekCard);
        });
    }

    // Update Overall Stats
    function updateStats() {
        if (!statTotalWeeks) return;
        if (!state.multiWeekData || !state.multiWeekData.weeksData) {
            statTotalWeeks.textContent = '0 Tuần';
            statTotalSubjects.textContent = '0';
            statTotalPeriods.textContent = '0';
            statActiveDays.textContent = '0';
            return;
        }

        const weeks = state.multiWeekData.weeksData;
        statTotalWeeks.textContent = `${weeks.length} Tuần`;

        const subjectsSet = new Set();
        let totalPeriods = 0;
        let totalActiveDays = 0;

        weeks.forEach(w => {
            w.days.forEach(d => {
                let dayHasLesson = false;
                ['Sáng', 'Chiều', 'Tối'].forEach(s => {
                    const lessons = d.sessions[s] || [];
                    if (lessons.length > 0) {
                        dayHasLesson = true;
                        totalPeriods += lessons.length;
                        lessons.forEach(l => {
                            if (l.subject) subjectsSet.add(l.subject);
                        });
                    }
                });
                if (dayHasLesson) totalActiveDays++;
            });
        });

        statTotalSubjects.textContent = subjectsSet.size;
        statTotalPeriods.textContent = totalPeriods;
        statActiveDays.textContent = `${totalActiveDays} Ngày`;
    }

    // Modal
    function openCourseModal(item, session) {
        activeModalItem = item;
        const periodTimeMap = {
            '1': '07:00 - 09:25',
            '2': '09:35 - 12:00',
            '3': '13:00 - 15:25',
            '4': '15:35 - 18:00',
            '5': '18:00 - 20:25'
        };

        modalSessionBadge.textContent = `Ca ${item.period || '1'} (${session})`;
        modalSubjectTitle.textContent = item.subject || 'Môn học';
        modalSubjectCode.textContent = item.subjectCode ? `Mã HP: ${item.subjectCode}` : '';
        modalRoom.textContent = item.room || 'Đang cập nhật';
        modalProfessor.textContent = state.selectedName || item.professor || 'GV HVNH';
        modalClass.textContent = item.classId || 'N/A';
        modalGroup.textContent = item.group || 'Chính thức';
        modalTimeRange.textContent = periodTimeMap[item.period] || (session === 'Sáng' ? '07:00 - 11:30' : (session === 'Chiều' ? '13:00 - 17:30' : '18:00 - 21:00'));

        courseModal.classList.remove('hidden');
    }

    function closeModal() {
        courseModal.classList.add('hidden');
        activeModalItem = null;
    }

    function copyModalDetail() {
        if (!activeModalItem) return;
        const text = `📌 LỊCH GIẢNG DẠY HVNH:\n- Giảng viên: ${state.selectedName}\n- Môn: ${activeModalItem.subject} (${activeModalItem.subjectCode})\n- Phòng: ${activeModalItem.room}\n- Lớp: ${activeModalItem.classId}\n- Ca: ${activeModalItem.period}\n- Ngày: ${activeModalItem.dayName}`;
        navigator.clipboard.writeText(text).then(() => {
            alert('Đã sao chép thông tin lịch dạy vào Clipboard!');
        });
    }

    // Export 5 Weeks to ICS
    async function exportIcsFile() {
        if (!state.multiWeekData || !state.multiWeekData.weeksData) {
            alert('Vui lòng chọn Giảng viên để tải lịch trước khi xuất file!');
            return;
        }

        try {
            const res = await fetch('/api/export-ics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weeksData: state.multiWeekData.weeksData })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ThoiKhoaBieu_HVNH_5Tuan_${state.selectedName || 'GiangVien'}.ics`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert('Lỗi xuất file lịch!');
            }
        } catch (e) {
            console.error(e);
            alert('Không thể tạo file Calendar!');
        }
    }

    function showLoading(show) {
        if (show) {
            loadingState.classList.remove('hidden');
            emptyState.classList.add('hidden');
            timetableMultiWeekContainer.innerHTML = '';
        } else {
            loadingState.classList.add('hidden');
        }
    }
});
