const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
let PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const BASE_URL = 'https://online.hvnh.edu.vn';
const CACHE_DIR = path.join(__dirname, 'cache');

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let sessionCookies = '';

async function fetchHVNH(urlStr, options = {}) {
    let url = urlStr;
    const maxRedirects = 10;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
        attempts++;
        try {
            for (let i = 0; i < maxRedirects; i++) {
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    ...(options.headers || {})
                };
                if (sessionCookies) {
                    headers['Cookie'] = sessionCookies;
                }

                const res = await fetch(url, {
                    ...options,
                    redirect: 'manual',
                    headers
                });

                const setCookie = res.headers.get('set-cookie');
                if (setCookie) {
                    const newCookie = setCookie.split(';')[0];
                    sessionCookies = sessionCookies ? `${sessionCookies}; ${newCookie}` : newCookie;
                }

                const location = res.headers.get('location');
                if (location) {
                    url = location.startsWith('http') ? location : `${BASE_URL}${location}`;
                    continue;
                }

                return res;
            }
            throw new Error('Redirect limit reached fetching HVNH');
        } catch (err) {
            if (attempts >= maxRetries) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
    }
}

// Helper to find current active week based on current date or week header
function findCurrentWeekIndex(weeksList, pageHtml = '') {
    if (!weeksList || weeksList.length === 0) return 0;

    // Check if any option has selected attribute in page HTML
    if (pageHtml) {
        const $page = cheerio.load(pageHtml);
        let selVal = $page('#Week option[selected]').attr('value');
        if (selVal) {
            const idx = weeksList.findIndex(w => String(w.Week) === String(selVal));
            if (idx !== -1) return idx;
        }
    }

    // Date matching: Find week containing today's date
    const today = new Date();
    for (let i = 0; i < weeksList.length; i++) {
        const w = weeksList[i];
        if (w.WeekOfYear) {
            // Check if WeekOfYear corresponds to current calendar week of year
            const currentYearStart = new Date(today.getFullYear(), 0, 1);
            const currentWeekNum = Math.ceil((((today - currentYearStart) / 86400000) + currentYearStart.getDay() + 1) / 7);
            if (parseInt(w.WeekOfYear) === currentWeekNum) {
                return i;
            }
        }
    }

    return 0;
}

// 1. Initial Page Data
app.get('/api/initial', async (req, res) => {
    try {
        const response = await fetchHVNH(`${BASE_URL}/public/tracuuthoikhoabieu`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const parseOptions = (selectId) => {
            const opts = [];
            $(`#${selectId} option`).each((_, el) => {
                const val = $(el).attr('value') || '';
                const text = $(el).text().trim();
                const selected = $(el).attr('selected') !== undefined;
                if (val) {
                    opts.push({ value: val, text: text, selected });
                }
            });
            return opts;
        };

        const years = parseOptions('YearStudy');
        const terms = parseOptions('TermID');
        const classes = parseOptions('ClassStudentID');
        const professors = parseOptions('ProfessorID');
        const rooms = parseOptions('RoomID');
        const weeks = parseOptions('Week');

        const currentWeekOpt = weeks.find(w => w.selected) || weeks[0];

        res.json({
            success: true,
            data: { years, terms, classes, professors, rooms, weeks, currentWeek: currentWeekOpt }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Parser logic
function parseScheduleHtml(html, defaultClassId = '') {
    const $ = cheerio.load(html);
    let weekHeader = '';
    
    const headerText = $('div[style*="font-weight:bold"]').text().trim();
    if (headerText) {
        weekHeader = headerText.replace(/\s+/g, ' ');
    }

    const days = [];
    const dayNamesOrder = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

    $('table.maindivtb tr').each((rowIndex, tr) => {
        const tdList = $(tr).find('td');
        if (tdList.length < 4) return;

        const rawDayName = $(tdList[0]).text().trim();
        const matchedDay = dayNamesOrder.find(d => rawDayName.includes(d)) || rawDayName;

        const daySchedule = {
            dayName: matchedDay,
            rawDay: rawDayName,
            sessions: {
                'Sáng': [],
                'Chiều': [],
                'Tối': []
            }
        };

        const sessions = ['Sáng', 'Chiều', 'Tối'];

        sessions.forEach((sessionName, sIdx) => {
            const cell = $(tdList[sIdx + 1]);
            const divContents = cell.find('.divcontent');

            divContents.each((_, div) => {
                const htmlContent = $(div).html() || '';
                const textLines = htmlContent
                    .replace(/<br\s*\/?>/gi, '\n')
                    .split('\n')
                    .map(l => cheerio.load(l).text().trim())
                    .filter(Boolean);

                const item = {
                    rawText: textLines.join('\n'),
                    subject: '',
                    subjectCode: '',
                    group: '',
                    classId: defaultClassId,
                    period: '',
                    room: '',
                    professor: '',
                    note: '',
                    session: sessionName,
                    dayName: matchedDay
                };

                textLines.forEach(line => {
                    const clean = line.replace(/^[-•*]\s*/, '').trim();
                    if (/^Môn:/i.test(clean)) {
                        const val = clean.replace(/^Môn:/i, '').trim();
                        const codeMatch = val.match(/(.*?)\((.*?)\)/);
                        if (codeMatch) {
                            item.subject = codeMatch[1].trim();
                            item.subjectCode = codeMatch[2].trim();
                        } else {
                            item.subject = val;
                        }
                    } else if (/^Nhóm:/i.test(clean)) {
                        item.group = clean.replace(/^Nhóm:/i, '').trim();
                    } else if (/^Lớp:/i.test(clean)) {
                        item.classId = clean.replace(/^Lớp:/i, '').trim();
                    } else if (/^Ca:/i.test(clean)) {
                        item.period = clean.replace(/^Ca:/i, '').trim();
                    } else if (/^Phòng:/i.test(clean)) {
                        item.room = clean.replace(/^Phòng:/i, '').trim();
                    } else if (/^GV:/i.test(clean)) {
                        item.professor = clean.replace(/^GV:/i, '').trim();
                    } else if (/^Ghi chú:/i.test(clean)) {
                        item.note = clean.replace(/^Ghi chú:/i, '').trim();
                    }
                });

                if (item.subject || item.rawText) {
                    daySchedule.sessions[sessionName].push(item);
                }
            });
        });

        days.push(daySchedule);
    });

    return { weekHeader, days };
}

// Fetch 5 Weeks Data starting from online page CURRENT WEEK default
async function fetchFreshMultiWeekData(type, year, term, startWeek, count, id) {
    const pageRes = await fetchHVNH(`${BASE_URL}/public/tracuuthoikhoabieu`);
    const pageHtml = await pageRes.text();

    const weeksResponse = await fetchHVNH(`${BASE_URL}/Public/GetWeek/${year}$${term}`);
    let weeksList = [];
    if (weeksResponse.ok) {
        try { weeksList = await weeksResponse.json(); } catch(e) {}
    }

    if (!weeksList || weeksList.length === 0) {
        const $page = cheerio.load(pageHtml);
        $page('#Week option').each((_, el) => {
            const val = $page(el).attr('value');
            if (val) weeksList.push({ Week: val, DisPlayWeek: $page(el).text().trim() });
        });
    }

    let startIndex = 0;
    if (startWeek) {
        const foundIdx = weeksList.findIndex(w => String(w.Week) === String(startWeek) || String(w.WeekOfYear) === String(startWeek));
        if (foundIdx !== -1) startIndex = foundIdx;
    } else {
        startIndex = findCurrentWeekIndex(weeksList, pageHtml);
    }

    const targetWeeks = weeksList.slice(startIndex, startIndex + (parseInt(count) || 6));
    let endpointPattern = '/public/DrawingProfessorSchedule?YearStudy={year}&TermID={term}&Week={week}&ProfessorID={id}';

    const weeksData = [];
    for (const wObj of targetWeeks) {
        const wVal = wObj.Week;
        const fetchUrl = `${BASE_URL}${endpointPattern
            .replace('{year}', encodeURIComponent(year))
            .replace('{term}', encodeURIComponent(term))
            .replace('{week}', encodeURIComponent(wVal))
            .replace('{id}', encodeURIComponent(id))}&t=${Math.random()}`;

        try {
            const response = await fetchHVNH(fetchUrl);
            const html = await response.text();
            const parsed = parseScheduleHtml(html, id);
            weeksData.push({
                week: wVal,
                displayWeek: wObj.DisPlayWeek || wVal,
                weekHeader: parsed.weekHeader || `Tuần ${wObj.DisPlayWeek || wVal}`,
                days: parsed.days
            });
        } catch (e) {
            console.error(`Failed to fetch week ${wVal}:`, e.message);
        }
    }

    const actualStartWeek = targetWeeks[0] ? targetWeeks[0].Week : '';

    return {
        type,
        year,
        term,
        id,
        startWeek: actualStartWeek,
        weeksCount: weeksData.length,
        weeksData,
        lastUpdated: new Date().toISOString()
    };
}

// 2. Multi-Week Schedule Endpoint with Offline JSON Cache starting from Current Week
app.get('/api/multi-week-schedule', async (req, res) => {
    let { type = 'professor', year, term, startWeek, weeksCount = 6, id, sync } = req.query;
    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing parameter: id' });
    }

    if (!year || !term) {
        try {
            const initialRes = await fetchHVNH(`${BASE_URL}/public/tracuuthoikhoabieu`);
            const html = await initialRes.text();
            const $ = cheerio.load(html);
            if (!year) year = $('#YearStudy option[selected]').attr('value') || $('#YearStudy option').first().attr('value') || '';
            if (!term) term = $('#TermID option[selected]').attr('value') || $('#TermID option').first().attr('value') || '';
        } catch (e) {
            console.error('Failed to resolve default year/term:', e.message);
        }
    }

    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cacheFilePath = path.join(CACHE_DIR, `prof_${safeId}.json`);

    let cachedData = null;

    if (fs.existsSync(cacheFilePath)) {
        try {
            const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
            cachedData = JSON.parse(fileContent);
        } catch (e) {
            console.error("Cache read error:", e.message);
        }
    }

    // Explicit Sync / Online Update Check
    if (sync === 'true' || sync === '1') {
        try {
            const freshData = await fetchFreshMultiWeekData(type, year, term, startWeek, weeksCount, id);
            const isUpdated = !cachedData || JSON.stringify(freshData.weeksData) !== JSON.stringify(cachedData.weeksData);
            if (isUpdated) {
                console.log(`⚡ Schedule updated online for ${id}. Writing to offline JSON cache...`);
                fs.writeFileSync(cacheFilePath, JSON.stringify(freshData, null, 2), 'utf8');
            }
            return res.json({
                success: true,
                data: freshData,
                isUpdated,
                fromCache: false
            });
        } catch (e) {
            console.error('Sync error:', e.message);
            return res.json({
                success: true,
                data: cachedData || { weeksData: [] },
                isUpdated: false,
                fromCache: true,
                syncError: true
            });
        }
    }

    // Normal Request: Serve Cache Immediately if Available
    if (cachedData) {
        return res.json({
            success: true,
            data: cachedData,
            fromCache: true
        });
    } else {
        try {
            const freshData = await fetchFreshMultiWeekData(type, year, term, startWeek, weeksCount, id);
            fs.writeFileSync(cacheFilePath, JSON.stringify(freshData, null, 2), 'utf8');
            res.json({
                success: true,
                data: freshData,
                isUpdated: true,
                fromCache: false
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// 3. Export to ICS Calendar File
app.post('/api/export-ics', (req, res) => {
    const { weeksData = [], items = [], weekHeader = '' } = req.body;
    
    let allItems = [];

    if (weeksData && weeksData.length > 0) {
        weeksData.forEach(w => {
            let startDate = new Date();
            const dateMatch = (w.weekHeader || '').match(/từ\s*ngày\s*(\d{2})\/(\d{2})\/(\d{4})/i);
            if (dateMatch) {
                const [_, d, m, y] = dateMatch;
                startDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            }

            w.days.forEach(day => {
                ['Sáng', 'Chiều', 'Tối'].forEach(session => {
                    (day.sessions[session] || []).forEach(item => {
                        allItems.push({
                            ...item,
                            startDate
                        });
                    });
                });
            });
        });
    } else if (items && items.length > 0) {
        let startDate = new Date();
        const dateMatch = weekHeader.match(/từ\s*ngày\s*(\d{2})\/(\d{2})\/(\d{4})/i);
        if (dateMatch) {
            const [_, d, m, y] = dateMatch;
            startDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        }

        items.forEach(item => {
            allItems.push({
                ...item,
                startDate
            });
        });
    }

    const dayOffsetMap = {
        'Thứ 2': 0, 'Thứ 3': 1, 'Thứ 4': 2, 'Thứ 5': 3, 'Thứ 6': 4, 'Thứ 7': 5, 'Chủ nhật': 6
    };

    const periodTimeMap = {
        '1': { start: '070000', end: '092500' },
        '2': { start: '093500', end: '120000' },
        '3': { start: '130000', end: '152500' },
        '4': { start: '153500', end: '180000' },
        '5': { start: '180000', end: '202500' }
    };

    let icsLines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//HVNH Timetable Tool//VN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    allItems.forEach((item, index) => {
        const offset = dayOffsetMap[item.dayName] !== undefined ? dayOffsetMap[item.dayName] : 0;
        const baseDate = item.startDate ? new Date(item.startDate) : new Date();
        const itemDate = new Date(baseDate);
        itemDate.setDate(baseDate.getDate() + offset);

        const periodInfo = periodTimeMap[item.period] || (item.session === 'Sáng' ? periodTimeMap['1'] : (item.session === 'Chiều' ? periodTimeMap['3'] : periodTimeMap['5']));

        const yyyy = itemDate.getFullYear();
        const mm = String(itemDate.getMonth() + 1).padStart(2, '0');
        const dd = String(itemDate.getDate()).padStart(2, '0');

        const dtStart = `${yyyy}${mm}${dd}T${periodInfo.start}`;
        const dtEnd = `${yyyy}${mm}${dd}T${periodInfo.end}`;

        const summary = `${item.subject || 'Lịch dạy'} ${item.subjectCode ? '(' + item.subjectCode + ')' : ''}`;
        const location = item.room || 'Học viện Ngân hàng';
        const description = `Lớp: ${item.classId || ''}\\nCa: ${item.period || ''}\\nGV: ${item.professor || ''}\\nNhóm: ${item.group || ''}`;

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:hvnh-${Date.now()}-${index}@hvnh.edu.vn`);
        icsLines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
        icsLines.push(`DTSTART;TZID=Asia/Ho_Chi_Minh:${dtStart}`);
        icsLines.push(`DTEND;TZID=Asia/Ho_Chi_Minh:${dtEnd}`);
        icsLines.push(`SUMMARY:${summary}`);
        icsLines.push(`LOCATION:${location}`);
        icsLines.push(`DESCRIPTION:${description}`);
        icsLines.push('END:VEVENT');
    });

    icsLines.push('END:VCALENDAR');

    const icsContent = icsLines.join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ThoiKhoaBieu_HVNH_5Tuan.ics"');
    res.send(icsContent);
});

// Handle Port Fallback cleanly
function startServer(portToTry) {
    const server = app.listen(portToTry, () => {
        console.log(`🚀 HVNH Schedule Web App running at http://localhost:${portToTry}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${portToTry} is in use, trying port ${portToTry + 1}...`);
            startServer(portToTry + 1);
        } else {
            console.error('Server error:', err);
        }
    });
}

startServer(PORT);
