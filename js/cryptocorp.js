
//=======================================================================
// CryptoCorp API
//=======================================================================
var CryptoCorp = new function () {
	
	// configurables
	var host = "http://btc2.hyper.to";
  var KeyIndex = Object.freeze( { USER:0, BACKUP:1, ORACLE:2 } );
   	
	this.setOracleUrl = function( url ) {
		host = url.trim();
	};
	
	//-----------------------
	// Create Wallet
	//-----------------------
	this.CreateWallet = function (data, callback) {
    var walletId = getNewWalletId();
    var url = getWalletUrl( walletId );
    	post( url, data, callback );
	};
	
	//-----------------------
	// Get Wallet
	//-----------------------
	this.GetWallet = function (walletUrl, callback, payload) {
		get( walletUrl.trim(), callback, payload );
	};
	
	//-----------------------
	// Sign Tx
	//-----------------------
	this.SignTx = function (walletUrl, data, callback) {
	    url = getWalletTxUrl( walletUrl.trim() )
		post( url, data, callback );
	};
	
	// wallet url
	function getWalletUrl(walletId) {
		return host + "/wallets/" + walletId.trim();
	}
	
	// wallet url
	function getWalletTxUrl(walletUrl) {
		return walletUrl.trim() + "/transactions";
	}
	
	function get(url, callback, payload) {
		$.ajax({
			contentType: "application/json",
			crossDomain: true,
			url: url,
			type: 'GET',
			success: function ( response ) {
				successCallback( response, callback, payload );
			},
			error: function( xhr, textStatus, errorThrown ) {
				errorCallback( xhr, textStatus, errorThrown, callback, payload );
			},
			complete : function (xhr){
				return;
			}
		});
	}
	
	function post(url, data, callback, payload) {
		var stringified = JSON.stringify( data );
		$.ajax({
			contentType: "application/json",
			crossDomain: true,
			url: url,
			type: 'POST',
			data: stringified,
			success: function ( response ) {
				successCallback( response, callback, payload );
			},
			error: function( xhr, textStatus, errorThrown ) {
				errorCallback( xhr, textStatus, errorThrown, callback, payload );
			},
			complete : function (xhr){
				return;
			}
		});
	}
	
	// post callback - success
	function successCallback(data, callback, payload) {
		// if malformed data - invoke callback as error
		if( data == null  ||  data == 'undefined'  ||  data.result == 'undefined' ) {
			var response = { result: "error", errorThrown: "No Data" };
			postCallback( response );
			return;
		}
		// invoke callback 
		callback( data, payload ) ;
	}
	
	// post callback - ERROR
	function errorCallback(xhr, textStatus, errorThrown, callback, payload) {
		console.log("xhr.status:" +xhr.status);
		console.log("xhr.responseText:"+ xhr.responseText);
		console.log("textStatus:"+ textStatus);
		console.log("errorThrown:" +errorThrown);
		
		// repackage results
		if( xhr.readyState == 0 ) {
		    errorThrown = "Timeout";
		}
		var response = { result: "error", xhr: xhr, errorThrown: errorThrown };
		callback( response, payload );
	}	
	
	this.getWalletData = function( rulesetId, keys, parameters, pii ) {
	
		var data = { 
			"rulesetId": rulesetId, 
			"keys": keys, 
			"parameters": parameters, 
			"pii": pii 
		};
		return data;
	};
	
  this.getParameters = function( value, asset, period, delay ) {
    var parameters = { 
      "velocity_1": { "value": value, "asset": asset, "period": period, "delay": delay, "limited_keys": [ KeyIndex.USER ] }
    };
    return parameters;
  }
    
  this.getPii = function( email, first, last, phone ) {
    // TODO encrypt pii
    var enc = phone;
    var pii = { "email": email, "encrypted": enc };
    return pii;
  }
	
	this.getSignTxData = function( signatureIndex, bytes, inputScripts, chainPaths ) {
		var data  = {"signatureIndex": signatureIndex, "transaction": {"bytes": bytes, "inputScripts": inputScripts}, "chainPaths": chainPaths};
		return data;
	};
	
    function pad(str, len, ch) {
        padding = '';
        for (var i = 0; i < len - str.length; i++) {
            padding += ch;
        }
        return padding + str;
    }
	
    this.generate_redemption_script = function( pub1_str, pub2_str, pub3_str ) {
		
        pub1_str = pad( pub1_str.trim(), 65, '0' );
        var pub1 = Crypto.util.hexToBytes(pub1_str);

        pub2_str = pad( pub2_str.trim(), 65, '0' );
        var pub2 = Crypto.util.hexToBytes(pub2_str);

        pub3_str = pad( pub3_str.trim(), 65, '0' );
        var pub3 = Crypto.util.hexToBytes(pub3_str);

        var pubkey1 = new Bitcoin.ECKey();
        pubkey1.pub = pub1;
        pubkey1.pubKeyHash = Bitcoin.Util.sha256ripe160(pubkey1.pub);

        var pubkey2 = new Bitcoin.ECKey();
        pubkey2.pub = pub2;
        pubkey2.pubKeyHash = Bitcoin.Util.sha256ripe160(pubkey2.pub);

        var pubkey3 = new Bitcoin.ECKey();
        pubkey3.pub = pub3;
        pubkey3.pubKeyHash = Bitcoin.Util.sha256ripe160(pubkey3.pub);

        // New versions of BitcoinJS-lib have createMultiSigOutputScript, but the one 
        // currently in brainwallet at github doesn't have it, so we must build the
        // script manually.
        var redemption_script = new Bitcoin.Script();

	    var req_count = 2;
	    var outof_count = 3;
        redemption_script.writeOp([Bitcoin.Opcode.map["OP_1"], Bitcoin.Opcode.map["OP_2"], Bitcoin.Opcode.map["OP_3"]][req_count - 1]);
        
        var pubkeys = new Array(pub1, pub2, pub3);
        for( var i = 0; i < 3 && i < outof_count; i++ ) {
            redemption_script.writeBytes(pubkeys[i]);
        }

        redemption_script.writeOp(Bitcoin.Opcode.map["OP_1"] + (pubkeys.length - 1));
        redemption_script.writeOp(Bitcoin.Opcode.map["OP_CHECKMULTISIG"]);

        var redemption_script_str = Crypto.util.bytesToHex(redemption_script.buffer);
		return redemption_script_str;
    };
    
  function getNewWalletId() {
    return createUUID() ;
  }
  
  function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
  }
};