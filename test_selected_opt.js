const cheerio = require('cheerio');
const fs = require('fs');

async function testCheerioSelectedWeek() {
    const res = await fetch('https://online.hvnh.edu.vn/public/tracuuthoikhoabieu');
    const html = await res.text();
    const $ = cheerio.load(html);

    let val1 = $('#Week option[selected]').attr('value');
    let val2 = $('#Week option[selected="selected"]').attr('value');
    let val3 = '';
    $('#Week option').each((i, el) => {
        const isSel = $(el).is(':selected') || $(el).attr('selected') !== undefined;
        if (isSel) {
            val3 = $(el).attr('value');
            console.log(`Option ${i} is selected: value=${val3}, text=${$(el).text()}`);
        }
    });

    console.log("val1:", val1, "val2:", val2, "val3:", val3);
}

testCheerioSelectedWeek().catch(console.error);
