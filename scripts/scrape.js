  // 2. Scrape Bills Most Important Games (MIG)
  try {
    const migHtml = await fetchHtml(billsMigUrl);
    const $ = cheerio.load(migHtml);
    const dynamicGuide = [];

    $('tr').each((_, el) => {
      const rowText = $(el).text();
      // Only check games with a winner listed that Buffalo is NOT playing in
      if (
        rowText.includes('Wins') && 
        (rowText.includes('vs') || rowText.includes('@')) &&
        !rowText.includes('Bills')
      ) {
        const cells = $(el).find('td').map((_, td) =>$(td).text().trim()).get();
        if (cells.length >= 3) {
          const matchup = cells[0].replace(/\s+/g, ' ');
          const preference = cells.find(c => c.includes('Wins'));
          if (preference && dynamicGuide.length < 3) {
            dynamicGuide.push({
              target: `Root for ${preference.trim()}`,
              why: `Matchup: ${matchup}. Key out-of-town scoreboard leverage for Buffalo's seeding.`
            });
          }
        }
      }
    });

    if (dynamicGuide.length > 0) {
      billsData.rootingGuide = dynamicGuide;
      console.log(`Parsed ${dynamicGuide.length} neutral rooting matchups for Bills.`);
    }
  } catch (err) {
    console.warn('Bills MIG fallback used:', err.message);
  }
