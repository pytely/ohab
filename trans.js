// Основная программа - запускаем ее командой "forever start -o trans.log trans.js" из "/home/pytely/ohab"
// Она также перезапускается cronом из bot.rules в Openhab
try {
	var fs = require('fs'); // базовые модули nodejs
	var path = require('path');
	var http = require('http');
	var https = require('https');
	var bodyParser = require('body-parser'); // модуль разборки POST запросов
	var express = require('express'); // Продвинутый сервер для http запросов
	var app = express();
	var unirest = require('unirest'); // модуль отправки REST запросов
	var Form = require('form-data'); // формирование multiform-data
	var gm = require('gm'); // модуль конвертации файлов изображений
	// Блок загрузки конфигураций и перезапуска программ при изменениях
	var transdir = path.dirname(process.argv[1]);
	process.chdir(transdir);
	var transjson = './' + path.basename(process.argv[1], path.extname(process.argv[1])) + '.json';
	var conf = require(transjson); // загрузка параметров конфигурации в объект conf

	fs.watch('./', function(event, filename) { // Перезапуск скрипта если изменилась
		if (filename == 'trans.js') {
			process.exit()
		}; // конфигурация или сам серипт
		if (filename == 'trans.json') {
			process.exit()
		};
	});
	// Блок функций считывания конфигурации из openhab
	// на каждый Item в Openhab мы создаем Event Emmiter
	// который является полным аналогом одного из уже имеющихся
	// в Openhab классов

	// Блок функций общения с Telegram и Openhab
	var vnukovo_bot = 'https://api.telegram.org/bot' + conf.botkey + '/';
	var vnukovo_bat = `https://api.telegram.org/bot${conf.botkey}/`;

	function sendMessage(chat, text) { // отправка сообщений в Telegram
		unirest.get(vnukovo_bot + 'sendMessage').query({
			'chat_8id': chat,
			'text': text
		}).end();
	};

	function sendCommand(text) { // Отправка поступившей из Telegram команды в Openhab 
		unirest.post(conf.ohabhttp + 'rest/items/Telestring') // через переменную(Item) Telestring. 
			.header({
				'content-type': 'text/plain'
			}) // Обрабатывается bot.rules
			.send(text)
			.end();
	};

	function graph(chat, type, name, period) { // Получение png и отправка jpg файла с графиком из Openhab
		var img = 'jpg';
		var chart = conf.ohabhttp + 'chart?' + type + '=' + name + '&period=' + period + '&w=500&h=300';
		http.get(chart, function(response) {
			gm(response, 'img.png').toBuffer(img, function(err, buffer) {
				var form = new Form();
				form.append('chat_id', chat);
				form.append('photo', buffer, {
					'filename': name + '.' + img,
					'contentType': 'image/' + img
				});
				form.submit(vnukovo_bot + 'sendPhoto');
			});
		});
	};
	// Блок входных функций нашего сервера
	app.use(bodyParser.json()); // все multipart req.body будут преобразовываться в json.

	app.get('/ohabtest', function(req, res) { // Openhab на старте проверяет запущен ли сервис
		res.set({
			'Content-Type': 'text/plain; charset=UTF-8'
		});
		res.write('ohabMiddleware');
		res.end();
	});

	app.get('/ohabclose', function(req, res) { // Openhab сюда дает команду на завершение работы сервиса
		res.set({
			'Content-Type': 'text/plain; charset=UTF-8'
		});
		res.write('ohabMiddleware closed');
		res.end();
		process.exit();
	});

	app.post('/ohab', function(req, res) { // это главный webHook, на котором слушаем сообщения из Telegram
		var ms = req.body.message;
		var chat = ms.chat.id;
		//		sendMessage(chat,vnukovo_bat);
		if (ms.text) {
			sendCommand(ms);
			conf.graphs.forEach(function(g) { // настройка графиков лежит в trans.json
				if (ms.text == g.text) {
					graph(chat, g.type, g.name, g.period)
				};
			});
		};
		res.set({
			'Content-Type': 'text/plain; charset=UTF-8'
		});
		res.end();
	});
	// Блок запуска http и https серверов
	//	var creds = { key: fs.readFileSync(conf.serverkey), 		// ключи для ssl.
	//			   cert: fs.readFileSync(conf.pemfile)};

	var httpServer = http.createServer(app); // для обработки http
	//	var httpsServer = https.createServer(creds, app);	// для обработки https

	httpServer.listen(conf.httpport); //   http  на 8124
	//	httpsServer.listen(conf.httpsport);			// и https на 8143
}
catch (err) {
	console.log('Error: ' + err.message);
}
