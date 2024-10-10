const axios = require('./services/axios.js');
const cheerio = require('cheerio');
const fs = require('node:fs');
const path = require('node:path');
const cron = require('node-cron');
const simpleGit = require('simple-git');
const beautify = require('js-beautify').html;
const git = simpleGit();

const VISITED_URLS = new Set();
const WWW_DIR = './www';

if (!fs.existsSync(WWW_DIR)) fs.mkdirSync(WWW_DIR);

const fetchPageContent = async url => {
	try {
		console.log(`Fetching content from: ${url}`);
		const { data } = await axios.get(url);
		return data;
	} catch (err) {
		console.error(err.stack);
		return null;
	}
};

const saveToFile = (content, fileName) => fs.writeFileSync(fileName, content, 'utf8');
const hasChanges = (newContent, filePath) => !fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== newContent;

const cleanContent = html => {
	const $ = cheerio.load(html);

	$('script').each((_, el) => {
		if ($(el).html()?.startsWith('(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement(\'script\');')) $(el).remove();
	});

	$('a[href], link[href]').each((_, el) => {
		const href = $(el).attr('href').split(/[?#]/)[0];
		$(el).attr('href', href);
	});

	$('[data-cf-beacon], [data-cfemail]').removeAttr('data-cf-beacon data-cfemail');

	return beautify($.html(), {
		indent_size: 4,
		wrap_line_length: 120,
		preserve_newlines: true,
		unformatted: ['pre', 'code', 'li']
	});
};

const filterInvalidLinks = url => !url.includes('cdn-cgi') && !url.startsWith('mailto:');

const urlToFileName = url => {
	if (url === 'https://niedlascamu.pl') return path.join(WWW_DIR, 'index.html');
	if (url === 'https://niedlascamu.pl/') return;
	const cutUrl = url.replace('https://niedlascamu.pl/index.php?page=', '');
	const sanitizedUrl = cutUrl.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
	return path.join(WWW_DIR, `${sanitizedUrl}.html`);
};

const crawlPage = async url => {
	if (VISITED_URLS.has(url)) return;

	VISITED_URLS.add(url);
	const content = await fetchPageContent(url);
	if (!content) return;

	const cleanedContent = cleanContent(content);
	const fileName = urlToFileName(url);
	if (!fileName) return;

	if (hasChanges(cleanedContent, fileName)) {
		saveToFile(cleanedContent, fileName);
	}

	const $ = cheerio.load(content);
	const links = $('a[href]')
		.map((_, el) => $(el).attr('href'))
		.get()
		.filter(filterInvalidLinks)
		.map(link => new URL(link, url).href);

	for (const link of links) {
		if (!VISITED_URLS.has(link) && link.startsWith('https://niedlascamu.pl')) {
			await crawlPage(link);
		}
	}
};

const crawl = async () => {
	VISITED_URLS.clear();
	await crawlPage('https://niedlascamu.pl');

	try {
		const { modified, created, deleted } = await git.status();
		if (![...modified, ...created, ...deleted].length) {
			console.log('No changes to commit');
			return;
		}

		await git.pull('origin', 'main');

		await git.add('.');

		const currentDate = new Date();
		const formattedDate = currentDate.toLocaleString('pl-PL', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});

		await git.commit(`Content updated, date: ${formattedDate}`);
		await git.push('origin', 'main');
		console.log('Changes committed to Git');
	} catch (err) {
		console.error(err);
	}
};

cron.schedule('0 */6 * * *', crawl);

crawl();