// Основная программа - запускаем ее командой "forever start -o ohab.log ohab.js" из "/home/pytely/ohab"
try {
	var fs = require('fs'); 			// базовые модули nodejs
	var http = require('http');
	var https = require('https');

	var moment = require('moment'); 		// модуль форматирования дат
	moment.locale('ru');

	var bodyParser = require('body-parser'); 	// модуль разборки POST запросов

	var express = require('express'); 		// Продвинутый сервер для http запросов
	var app = express();

	var unirest = require('unirest'); 		// модуль отправки REST запросов

	// настройки Telegram для доступа в @vnukovo_bot
	var ohabkey = '177451312:AAGewQKdnszmAAvnWP0qZFTemT6AnYyF5LU';
	var ohab_bot = 'https://api.telegram.org/bot' + ohabkey + '/';

	function sendMessage(chat, text) {		// отправка сообщений в Telegram
		unirest.get(ohab_bot + 'sendMessage').query({'chat_id': chat,'text': text}).end();
	}

	function sendCommand(text) {
		unirest.put('http://192.168.4.8:8080/rest/items/Telestring/state')
				.header({'content-type':'text/plain'})
				.send(text)   
				.end();
	}

	app.use(bodyParser.json()); 			// все req.body будут преобразовываться в json.

	app.post('/ohab', function(req, res) {	// это главный webHook для сообщений из Telegram
		var ms = req.body.message;
		if(ms.text) {
			sendCommand(ms);
			console.log(ms);
		};
		res.set({'Content-Type': 'text/plain; charset=UTF-8'}); // чтобы запрос Telegram успешно завершился
		res.end();
	});


	app.get('/set_ohab', function(req, res) { 
		unirest.post(ohab_bot + 'setWebhook') 		 // Цепляемся к входящему потоку Telegram webHookом
		.field({url:'https://pytely.homeip.net/ohab'}) // и при появлении сообщений в Чате получаем вызов этой функции
		.attach({certificate:'/home/pytely/pytely.pem'}) // А без этого не будет работать самоподписанный сертификат
		.end(function(res) {
			if(!res) { console.log('Функция setWebhook вернула пустой ответ'); return; };	
			console.log('Соединение с @vnukovo_bot установлено. Ждем команд.');
			console.log(moment(Date.now()).format('dddd H:mm:ss ZZ') + ' ' + moment.locale());
		});
		res.set({'Content-Type': 'text/plain; charset=UTF-8'}); // чтобы запрос Telegram успешно завершился
		res.end();
	});

	app.get('/close_ohab', function(req, res) { 
		unirest.post(ohab_bot + 'setWebhook') 		 // Отцепляемся от входящего потока Telegram
		.field({url:''})  				 // 
		.attach({certificate:'/home/pytely/pytely.pem'}) // А без этого не будет работать самоподписанный сертификат
		.end(function(res) {
			if(!res) { console.log('Функция setWebhook вернула пустой ответ'); return; };	
			console.log('Соединение с @vnukovo_bot разорвано.');
			console.log(moment(Date.now()).format('dddd H:mm:ss ZZ') + ' ' + moment.locale());
		});
		res.set({'Content-Type': 'text/plain; charset=UTF-8'}); // чтобы запрос Telegram успешно завершился
		res.end();
	});
	
	var creds = { key: fs.readFileSync('/home/pytely/server.key'), 		// ключи для ssl.
			   cert: fs.readFileSync('/home/pytely/pytely.pem')};

	var httpServer = http.createServer(app);		// используем один и тот же код приложения app 
	var httpsServer = https.createServer(creds, app);	// для обработки http и https

	httpServer.listen(8124);			// слушаем http на 8124 порту
	httpsServer.listen(8143);			// и https на 8143
} catch (err) {
	console.log("Error: " + err.message);
}
