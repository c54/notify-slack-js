
exports.get_config_file = function (_path) {
	if (_path == null) return './config.future.json';
	return _path;
}

// Slack Incoming WebHook 用の fields 定義作成
make_field = function (_title, _value, _short) {
	if (_value == null) {
		return "";
	}
	if (_value.size = 0) {
		return "";
	}

	var field = {
		title: _title
	,	value: _value
	,	short: _short
	};
	return field;
};


exports.make_send_text_by_json = function (dataJson) {
	if (!dataJson) {
		return null;
	}
	return make_send_text(dataJson._title, dataJson._owner, dataJson._time, dataJson._address, dataJson._place, dataJson._url, dataJson._hash_tag, dataJson._limit, dataJson._accepted, dataJson._send_text_header);
};


// 通知用テキストの作成
exports.make_send_text = function(_title, _owner, _time, _address, _place, _url, _hash_tag, _limit, _accepted, _send_text_header) {
	var send_text = 'payload=';
	var send_text_obj = _send_text_header;
	var fields = [];

	if (!_place) { _place = "場所不明" }
	if (!_address) { _address = "住所不明" }
	if (!_accepted) { _accepted = "_" }
	if (!_limit) { _limit = "住所不明" }

	fields.push(make_field('Title', _title, false));
	fields.push(make_field('Event Owner',_owner, false));
	fields.push(make_field('Participants',_accepted + '/' + _limit, false));
	fields.push(make_field('Time',_time, false));
	fields.push(make_field('Place',_place + '\n' + _address, false));
	fields.push(make_field('URL','<' + _url + '>', false));		
	fields.push(make_field('Hash tag',_hash_tag, false));

	send_text_obj.fields = fields;

	send_text = send_text + JSON.stringify(send_text_obj);

	return send_text;
};


// KVS 上に保存されているかのチェック
exports.check_key_uniqueness = function(_url, _db) {
	var return_value = null;
	if (!_url) {
		return "";
	}
	// 重複していなければ true を返す
 	_db.get(_url, function (err, value) {
	    if (err) {
	    	if (err.notFound) {
		    	console.log(_url + 'is not found');
		    	return_value = "";
		    } else {
		    	console.log('DB Error has occurd');
		    	return_value = "";
		    }
	    } else {
		    return_value = value;
		    console.log('value:' + value);
		}
	})

 	var timer = setInterval(function() {
	    //終了条件
	    if (return_value != null) {
		    clearInterval(timer);
    		console.log('ret:' + return_value);
			return return_value;
	    }
	}, 200);
};

// KVS にキーを保存
exports.save_key = function(_url, _title, _db) {
	if (!_url || !_title) return;
	_db.put(_url, _title, function (err) {
		if (err) return console.log('Ooops! LevelDB error has occured.', err);
		else return console.log(_url + ' ' + _title);
	}
	);
};

// NG title check
// NG の場合に true が返る
exports.isNgTitle = function(_title) {
	var ng_words = ["パーティ","恋活","婚活","アクー","[テスト] qkstudy #01","発達障害"];
	if (!_title) return false;

	for (var i = 0; i < ng_words.length; i++) {
		if(_title.indexOf(ng_words[i]) != -1) return true;
	}

	return false;
}


// slack に内容を post する関数
exports.postToSlack = (function(dataJson, db) {

	if (!dataJson || !dataJson._url || !db) {
		return "-1";
	}

	var key_val_ret;

	console.log(dataJson);

	db.get(dataJson._url, function (err, value) {
	    if (err) {
	    	if (err.notFound) {
		    	console.log(dataJson._url + ' is not found');
		    	key_val_ret = "";

				var send_text = slack_lib.make_send_text(_title, _owner, _time, _address, _place, _url, _hash_tag, _limit, _accepted, send_text_header);

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
						slack_lib.save_key(dataJson._url, dataJson._title, db);
						console.log('posted.' + dataJson._url + ' ' + i);
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
	});
	return key_val_ret;
});


