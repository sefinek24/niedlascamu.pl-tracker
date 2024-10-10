const axios = require('axios');

const instance = axios.create({
	headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
		'Accept-Language': 'pl;q=0.7',
		'Accept-Encoding': 'gzip, deflate, br, zstd',
		'Connection': 'keep-alive',
		'Upgrade-Insecure-Requests': '1'
	}
});

module.exports = instance;