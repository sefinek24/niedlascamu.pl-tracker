const axios = require('axios');
const { name, version, homepage } = require('../package.json');

const UserAgent = `Mozilla/5.0 (compatible; ${name}/${version}; +${homepage})`;

axios.defaults.headers.common = {
	'User-Agent': UserAgent,
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
	'Accept-Encoding': 'gzip, deflate, br',
	'Accept-Language': 'pl;q=0.9',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive',
	'Upgrade-Insecure-Requests': '1',
	'Sec-Fetch-Dest': 'document',
	'Sec-Fetch-Mode': 'navigate',
	'Sec-Fetch-Site': 'same-origin',
	'Sec-Fetch-User': '?1',
	'Sec-CH-UA-Mobile': '?0',
	'Priority': 'u=0, i'
};

axios.defaults.timeout = 20000;

module.exports = axios;