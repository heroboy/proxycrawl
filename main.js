const request = require('request');
const jsdom = require('jsdom');
const async = require('async');


/**
 * @type {Buffer}
 */
var testImageData = null;

var testImageUrl = 'http://cn.bing.com/s/a/hp_zh_cn.png';

var testImageDataPromise = new Promise(resolve=>{
	request({
		uri:testImageUrl,
		encoding:null
	},function(e,resp,body){
		console.log('get test image:' + body.length + ', isBuffer:' + Buffer.isBuffer(body));
		resolve(body);
	});
});

function testProxyAgain(proxy)
{
	return testImageDataPromise.then(data=>{
		return new Promise(resolve=>{
			request({
				uri:testImageUrl,
				proxy:proxy,
				timeout:30 * 1000,
				encoding:null
			},function(e,resp,body){
				if (Buffer.isBuffer(body) && Buffer.compare(body,data) == 0)
					return resolve(true);
				else
					return resolve(false);
			});
		});
		
	});
}


/**
 * @returns {Promise<boolean>}
 */
function testProxy(proxy)
{
	return new Promise(resolve=>{
		request({
			uri:'http://www.reddit.com/',
			proxy:proxy,
			timeout:30 * 1000
		},function(e,resp,body){
			var good = !!(!e && resp.statusCode == 200 && typeof body === 'string' && body.includes('"reddit: the front page of the internet"'))
			if (good)
			{
				return testProxyAgain(proxy).then(resolve);
			}
			resolve(false);
		});
	});
}


/**
 * @returns {Promise<['string','string']>}
 */
function queryProxies() 
{
	return new Promise(resolve => 
	{
		jsdom.env('http://www.xicidaili.com/nt/', function (e, window) {
			var ret = [];
			if (e) console.log(e);
			var ip_list_table = window.document.getElementById('ip_list');
			for (var elem of ip_list_table.children[0].children) {
				var tds = elem.getElementsByTagName('td');
				if (tds && tds[1] && tds[2]) {
					//console.log(tds[1].textContent + ':' + tds[2].textContent);
					ret.push([tds[1].textContent, tds[2].textContent]);
				}
			}
			resolve(ret);
		});
	});
}

testProxy(null).then(ret=>{
	console.log('init test:' + ret);
});

queryProxies().then(proxies=>{
	console.log('get ' + proxies.length + ' proxies');
	//console.log(proxies);
	var doneCount = 0;
	var goodCount = 0;

	function refresh(){
		process.title = `proxy ${doneCount}/${proxies.length}, good = ${goodCount}`;
	}

	var q = async.queue(function(task,callback){
		refresh();
		var p = 'http://' + task.ip + ':' + task.port;
		console.log('start test:' + p);
		testProxy(p).then(good=>{
			++doneCount;
			if (good) 
			{
				++goodCount;
				console.log('good:' + p);
			}
			refresh();
			callback(null);
		});
	},3);

	proxies.forEach(item=>q.push({
		ip:item[0],
		port:item[1]
	}));

});