const axios = require('./services/axios.js');
const cheerio = require('cheerio');
const { CronJob } = require('cron');
const simpleGit = require('simple-git');
const { html: beautifyHTML, css: beautifyCSS, js: beautifyJS } = require('js-beautify');
const fs = require('node:fs');
const path = require('node:path');
const git = simpleGit();

const WWW_DIR = './www';
const BASE_URL = ['https://niedlascamu.pl', 'https://banq.niedlascamu.pl'];
const TRACK_RESOURCES = ['css', 'js', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'pdf'];

const VISITED_URLS = new Set();

if (!fs.existsSync(WWW_DIR)) fs.mkdirSync(WWW_DIR);

const fetchPageContent = async url => {
	console.log(`GET ${url}`);
	try {
		const { data } = await axios.get(url);
		return data;
	} catch (err) {
		console.error(err.stack);
		return null;
	}
};

const saveToFile = (content, fileName) => fs.writeFileSync(fileName, content, 'utf8');
const saveBinaryToFile = (content, fileName) => fs.writeFileSync(fileName, content, 'binary');
const hasChanges = (newContent, filePath) => !fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== newContent;

const cleanContent = html => {
	const $ = cheerio.load(html);
	$('script').each((_, el) => {
		if ($(el).html()?.startsWith('(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement(\'script\');')) $(el).remove();
	});
	$('a[href], link[href]').each((_, el) => $(el).attr('href', $(el).attr('href').split(/[?#]/)[0]));
	$('[data-cf-beacon], [data-cfemail]').removeAttr('data-cf-beacon data-cfemail');
	return beautifyHTML($.html(), { indent_size: 4, wrap_line_length: 120, preserve_newlines: true, unformatted: ['pre', 'code', 'li'] });
};

const saveResources = async ($, fileName, baseUrl) => {
	const regex = new RegExp(`\\.(${TRACK_RESOURCES.join('|')})$`);

	$('link[href], script[src], img[src], source[src], a[href]').each(async (_, el) => {
		let resourceUrl = $(el).attr('href') || $(el).attr('src');
		resourceUrl = resourceUrl.split('?')[0];

		if (resourceUrl && regex.test(resourceUrl)) {
			if (!resourceUrl.startsWith('http')) resourceUrl = new URL(resourceUrl, baseUrl).href;

			const resourceDomain = new URL(resourceUrl).origin;
			if (!BASE_URL.includes(resourceDomain)) return;

			const ext = path.extname(resourceUrl).slice(1).toLowerCase();
			const resourceDir = path.join(path.dirname(fileName), ext);
			if (!fs.existsSync(resourceDir)) fs.mkdirSync(resourceDir);

			const resourceFileName = path.join(resourceDir, path.basename(resourceUrl));
			if (!fs.existsSync(resourceFileName)) {
				try {
					const { data } = await axios.get(resourceUrl, { responseType: ext === 'css' || ext === 'js' ? 'text' : 'arraybuffer' });
					if (ext === 'css') saveToFile(beautifyCSS(data, { indent_size: 4 }), resourceFileName);
					else if (ext === 'js') saveToFile(beautifyJS(data, { indent_size: 4 }), resourceFileName);
					else saveBinaryToFile(data, resourceFileName);
				} catch (err) {
					console.error(err.stack);
				}
			}
		}
	});
};

const urlToFileName = (url, baseUrl) => {
	const domainFolder = new URL(baseUrl).hostname;
	const domainDir = path.join(WWW_DIR, domainFolder);
	if (!fs.existsSync(domainDir)) fs.mkdirSync(domainDir);

	let sanitizedUrl = url.replace(baseUrl, '')
		.replace(/\/$/, '')
		.replace(/[^a-z0-9\\/]/gi, '-')
		.replace(/\//g, '_')
		.toLowerCase();

	if (url.includes('index.php?page=')) {
		sanitizedUrl = url.split('index.php?page=')[1]
			.replace(/[^a-z0-9_]/gi, '-')
			.toLowerCase();
	}

	sanitizedUrl = sanitizedUrl.replace(/^[-_]+|[-_]+$/g, '');

	if (sanitizedUrl === '') return path.join(domainDir, 'index.html');
	return path.join(domainDir, `${sanitizedUrl}.html`);
};

const crawlPage = async (url, baseUrl) => {
	if (VISITED_URLS.has(url)) return;
	VISITED_URLS.add(url);

	const content = await fetchPageContent(url);
	if (!content) return;

	const fileName = urlToFileName(url, baseUrl);
	if (!fileName) return;

	const $ = cheerio.load(content);
	await saveResources($, fileName, baseUrl);

	const cleanedContent = cleanContent(content);
	if (hasChanges(cleanedContent, fileName)) saveToFile(cleanedContent, fileName);

	const links = $('a[href]').map((_, el) => $(el).attr('href')).get()
		.filter(link => !link.includes('cdn-cgi') && !link.startsWith('mailto:') && !link.includes('#'))
		.map(link => new URL(link, url).href)
		.filter(link => link.startsWith(baseUrl));

	for (const link of links) await crawlPage(link, baseUrl);
};

const crawl = async () => {
	VISITED_URLS.clear();

	for (const baseUrl of BASE_URL) await crawlPage(baseUrl, baseUrl);

	try {
		const { modified, created, deleted, not_added } = await git.status();
		if (![...modified, ...created, ...deleted, ...not_added].length) return console.log('No changes to commit');

		await git.pull('origin', 'main');
		await git.add('.');
		await git.commit(`Content updated, date: ${new Date().toLocaleString('pl-PL')}`);
		await git.push('origin', 'main');

		if (modified.length > 0) console.log('Modified', modified);
		if (created.length > 0) console.log('Created', created);
		if (deleted.length > 0) console.log('Deleted', deleted);
		if (not_added.length > 0) console.log('Not added', not_added);
	} catch (err) {
		console.error('Error during Git operations ):', err);
	}
};

new CronJob('0 */4 * * *', crawl, null, true, 'Europe/Warsaw');
(async () => crawl())();