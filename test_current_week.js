async function testCurrentWeek() {
    const res = await fetch('http://localhost:3000/api/initial');
    const data = await res.json();
    console.log("Total weeks:", data.data.weeks ? data.data.weeks.length : 0);
    const selectedWeekOpt = (data.data.weeks || []).find(w => w.selected);
    console.log("Selected week default on online page:", selectedWeekOpt);
}

testCurrentWeek().catch(console.error);
