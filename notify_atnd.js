// define
var request = require('request');
var levelup = require('levelup');
var fs = require('fs');
var to_json = require('xmljson').to_json;
var slack_lib = require('./slack_lib.js');

var config_file = slack_lib.get_config_file(process.argv[2]);

// read config file 
var config = JSON.parse(fs.readFileSync(config_file, 'utf8'));

// target service 
var service_info_json = config.service_properties.atnd;

var request_api_url = service_info_json.api_url;
var web_hook_url = config.web_hook_url;

var send_text_header = {
	channel: config.channel
,	username: service_info_json.bot_name
,	icon_url: "./assets/icon/atnd.icon.png"
,	fallback: config.fallback_msg
,	pretext: config.pretext_msg
,	color: service_info_json.color
};

// 重複防止用キー保存用 KVS
var db = levelup(service_info_json.kvs_name);


var notify = function () {

	// KVS にキーを保存
	function save_key(_url, _title) {
		if (!_url || !_title) return;
		db.put(_url, _title, function (err) {
			if (err) return console.log('Ooops! LevelDB error has occured.', err);
			else return console.log(_url + ' ' + _title);
		}
	);
	}

	function notify_slack(json_text) {
		// var json_obj = JSON.parse(json_text);
		var json_obj = json_text;
		var send_text;

		for (var i=0; i<json_obj.results_returned; i++) {
			var _title = json_obj.events.event[i].title;
			var _owner = json_obj.events.event[i].owner_nickname;
			var _time = json_obj.events.event[i].started_at;
			var _address = json_obj.events.event[i].address;
			var _place = json_obj.events.event[i].place;
			var _url = json_obj.events.event[i].event_url;
			var _hash_tag = "";
			var _limit = json_obj.events.event[i].limit;
			if (!_limit) _limit = "";
			var _accepted = json_obj.events.event[i].accepted;

			var _key_val = null;

			// 重複していなければ true を返す
			(function(j_title, j_owner, j_time, j_address, j_place, j_url, j_hash_tag, j_limit, j_accepted, key_val_ret){ 

				// NG ワードに引っかかった場合はスキップ
				if (slack_lib.isNgTitle(j_title)) return;

				// 東京と横浜以外のイベントはスキップ
				if (j_address != null) {
					if (j_address.indexOf("横浜") == -1 && j_address.indexOf("東京") == -1) {
						return;
					}
				}
				
				db.get(j_url, function (err, value) {
				    if (err) {
				    	if (err.notFound) {
					    	console.log(j_url + ' is not found');
					    	key_val_ret = "";

							send_text = slack_lib.make_send_text(j_title, j_owner, j_time, j_address, j_place, j_url, j_hash_tag, j_limit, j_accepted, send_text_header);

							var options = {
								uri: web_hook_url,
								form: send_text,
								json: true
							};

							request.post(options, function(error, response, body){
								if (error || response.statusCode != 200) {
								    console.log('error: '+ response.statusCode + '\n' + options.form);
								} else {
									// キーをセーブ
									slack_lib.save_key(j_url, j_title, db);
									console.log('posted.' + j_url + ' ' + i);
								}
							});						
					    } else {
					    	console.log('DB Error has occurd');
					    	key_val_ret = "";
					    }
				    } else {
					    key_val_ret = value;
					    console.log('already posted.: ' + value);
					}
				})
			})(_title, _owner, _time, _address, _place, _url, _hash_tag, _limit, _accepted, _key_val);
		}
	}

	request(request_api_url, function (error, response, body) {
		if (error || response.statusCode != 200) {
			return;
		}
		var result_json = (function(){
			to_json(body, function (error, data) {
		   		if (error) {
		   			console.log('ERROR: XML -> JSON conversion.');
		   		} else {
   					var result_log = notify_slack(data.hash);
		   		}
			});			
		})();
	})
};

notify();
