async function testCurrentWeekStart() {
    const port = 3000;
    console.log("=== Testing 5-Week Multi-Schedule starting from CURRENT week ===");
    const res = await fetch(`http://localhost:${port}/api/multi-week-schedule?type=professor&year=2026-2027&term=HK01&id=NHH00966&weeksCount=5`);
    const data = await res.json();
    console.log("Success:", data.success);
    console.log("Start week:", data.data.startWeek);
    console.log("Weeks fetched count:", data.data.weeksCount);
    
    data.data.weeksData.forEach((w, i) => {
        console.log(`- Week ${i + 1} (${w.weekHeader}): week code ${w.week}`);
    });
}

testCurrentWeekStart().catch(console.error);
